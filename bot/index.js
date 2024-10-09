import * as express from "express";
import { consola } from "consola";
import { renderIssues, createIssue } from "./utils/renderer/index.js";
import dbInstance from "./db.js";
import {
  checkEnvVariable,
  isRepoEmpty,
  verifyInstallationAnalytics,
  intializeDatabase,
  verifyRepoName,
  applyLastModifiedTemplate,
  getDefaultBranch,
} from "./utils/tools/index.js";
import { checkForLicense } from "./license/index.js";
import { checkForCitation } from "./citation/index.js";
import { checkForCodeMeta } from "./codemeta/index.js";
import { getCWLFiles, applyCWLTemplate } from "./cwl/index.js";
import { getZenodoDepositionInfo, getZenodoMetadata, updateZenodoMetadata, uploadReleaseAssetsToZenodo } from "./archival/index.js";
import fs from 'fs';
import { validateMetadata, getCitationContent, getCodemetaContent, updateMetadataIdentifier } from "./metadata/index.js";

checkEnvVariable("GITHUB_APP_NAME");
checkEnvVariable("CODEFAIR_APP_DOMAIN");

const ZENODO_API_ENDPOINT = process.env.ZENODO_API_ENDPOINT;
const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
const licensesJson = JSON.parse(fs.readFileSync('./public/assets/data/licenses.json', 'utf8'));

const ISSUE_TITLE = `FAIR Compliance Dashboard`;
const CLOSED_ISSUE_BODY = `Codefair has been disabled for this repository. If you would like to re-enable it, please reopen this issue.`;
const ZENODO_API = process.env.ZENODO_API_ENDPOINT;
const { ZENODO_ENDPOINT } = process.env;

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default async (app, { getRouter }) => {
  // Connect to the database
  await intializeDatabase();

  const db = dbInstance;

  await db.ping.create({
    data: { timestamp: new Date() },
  });

  const router = getRouter("/");

  router.use(express.static("public"));

  router.get("/healthcheck", (req, res) => {
    res.status(200).send("Health check passed");
  });

  // When the app is installed on an Org or Repository
  app.on(
    ["installation.created", "installation_repositories.added"],
    async (context) => {
      const repositories =
        context.payload.repositories || context.payload.repositories_added;
      const owner = context.payload.installation.account.login;
      let actionCount = 0;
      let applyActionLimit = false;
      let repoCount = 0;

      // shows all repos you've installed the app on
      for (const repository of repositories) {
        repoCount++;

        if (repoCount > 5) {
          consola.info(`Applying action limit to ${repository.name}`);
          applyActionLimit = true;
          actionCount = 5;
        }

        // Check if the repository is empty
        const emptyRepo = await isRepoEmpty(context, owner, repository.name);

        const latestCommitInfo = {};
        if (!emptyRepo) {
          // Get the name of the main branch
          const defaultBranch = await context.octokit.repos.get({
            owner,
            repo: repository.name,
          });

          const mainBranch = defaultBranch.data.default_branch;
          // Gather the latest commit to main info
          const latestCommit = await context.octokit.repos.getCommit({
            owner,
            ref: mainBranch,
            repo: repository.name,
          });

          latestCommitInfo.latest_commit_sha = latestCommit.data.sha || "";
          latestCommitInfo.latest_commit_message =
            latestCommit.data.commit.message || "";
          latestCommitInfo.latest_commit_url =
            latestCommit.data.html_url || "";
          latestCommitInfo.latest_commit_date =
            latestCommit.data.commit.committer.date || "";
        }

        // Check if entry in installation and analytics collection
        await verifyInstallationAnalytics(
          context,
          repository,
          actionCount,
          latestCommitInfo,
        );

        if (applyActionLimit) {
          // Do nothing but add repo to db, after the first 5 repos, the action count will determine when to handle the rest
          continue;
        }

        // BEGIN CHECKING FOR COMPLIANCE
        const license = await checkForLicense(context, owner, repository.name);
        const citation = await checkForCitation(
          context,
          owner,
          repository.name,
        );
        const codemeta = await checkForCodeMeta(
          context,
          owner,
          repository.name,
        );
        const cwl = await getCWLFiles(context, owner, repository.name);

        const cwlObject = {
          contains_cwl: cwl.length > 0 || false,
          files: cwl,
          removed_files: [],
        };

        // If existing cwl validation exists, update the contains_cwl value
        // If existing cwl validation exists, update the contains_cwl value
        const cwlExists = await dbInstance.cwlValidation.findUnique({
          where: { repository_id: repository.id },
        });

        if (cwlExists?.contains_cwl_files) {
          cwlObject.contains_cwl = cwlExists.contains_cwl_files;
        }

        const subjects = {
          citation,
          codemeta,
          cwl: cwlObject,
          license,
        };

        // Create issue body template
        const issueBody = await renderIssues(
          context,
          owner,
          repository,
          emptyRepo,
          subjects,
        );

        // Create an issue with the compliance issues body
        await createIssue(context, owner, repository, ISSUE_TITLE, issueBody);
      }
    },
  );

  app.on(
    ["installation.deleted", "installation_repositories.removed"],
    async (context) => {
      const repositories =
        context.payload.repositories || context.payload.repositories_removed;

      for (const repository of repositories) {
        // Check if the installation is already in the database
        const installation = await db.installation.findUnique({
          where: {
            id: repository.id,
          },
        });

        const license = await db.licenseRequest.findUnique({
          where: {
            repository_id: repository.id,
          },
        });

        const metadata = await db.codeMetadata.findUnique({
          where: {
            repository_id: repository.id,
          },
        });

        const cwl = await db.cwlValidation.findUnique({
          where: {
            repository_id: repository.id,
          },
        });

        if (license) {
          await db.licenseRequest.delete({
            where: {
              repository_id: repository.id,
            },
          });
        }

        if (metadata) {
          await db.codeMetadata.delete({
            where: {
              repository_id: repository.id,
            },
          });
        }

        if (cwl) {
          await db.cwlValidation.delete({
            where: {
              repository_id: repository.id,
            },
          });
        }

        if (installation) {
          // Remove from the database
          await db.installation.delete({
            where: {
              id: repository.id,
            },
          });
        }

        consola.info("Repository uninstalled:", repository.name);
      }
    },
  );

  // When a push is made to a repository
  app.on("push", async (context) => {
    // Event for when a push is made to the repository (listens to all branches)
    const owner = context.payload.repository.owner.login;
    const { repository } = context.payload;

    // If push is not going to the default branch don't do anything
    if (
      context.payload.ref !==
      `refs/heads/${context.payload.repository.default_branch}`
    ) {
      consola.warn("Not pushing to default branch, ignoring...");
      return;
    }

    const emptyRepo = await isRepoEmpty(context, owner, repository.name);

    const latestCommitInfo = {
      latest_commit_date: context.payload.head_commit.timestamp,
      latest_commit_message: context.payload.head_commit.message,
      latest_commit_sha: context.payload.head_commit.id,
      latest_commit_url: context.payload.head_commit.url,
    };

    // Check if the author of the commit is the bot
    const commitAuthor = context.payload.head_commit.author;
    if (commitAuthor && commitAuthor.username === "codefair-test[bot]") {
      const commitMessages = ["refactor: 📝♻️ Update CITATION.cff with Zenodo identifier", "refactor: 📝♻️ Update codemeta.json with Zenodo identifier"]
      consola.info("Commit made by codefair-test, checking commit message...");
      if (latestCommitInfo.latest_commit_message.includes(commitMessages[0]) || latestCommitInfo.latest_commit_message.includes(commitMessages[1])) {
      consola.info("Skipping validation as per commit message.");
      return;
      }
    }

    let fullCodefairRun = false;

    const installation = await db.installation.findUnique({
      where: {
        id: repository.id,
      },
    });

    if (!installation) {
      return;
    } else {
      verifyRepoName(
        installation.repo,
        repository,
        owner,
        db.installation,
      );

      if (installation?.action_count > 0) {
        consola.warn(
          "Action limit count down:",
          installation.action_count,
          "for",
          repository.name,
        );
        const result = await db.installation.update({
          data: {
            action_count: {
              set:
                installation.action_count - 1 < 0
                  ? 0
                  : installation.action_count - 1,
            },
            latest_commit_date: latestCommitInfo.latest_commit_date,
            latest_commit_message: latestCommitInfo.latest_commit_message,
            latest_commit_sha: latestCommitInfo.latest_commit_sha,
            latest_commit_url: latestCommitInfo.latest_commit_url,
          },
          where: { id: repository.id },
        });

        console.log(result);

        return;
      }

      if (installation?.action_count === 0) {
        consola.warn("Removing action limit for", repository.name);
        db.installation.update({
          data: {
            action_count: 0,
            latest_commit_date: latestCommitInfo.latest_commit_date,
            latest_commit_message: latestCommitInfo.latest_commit_message,
            latest_commit_sha: latestCommitInfo.latest_commit_sha,
            latest_commit_url: latestCommitInfo.latest_commit_url,
          },
          where: { id: repository.id },
        });

        fullCodefairRun = true;
      }
    }

    // Grab the commits being pushed
    const { commits } = context.payload;

    let cwl = [];
    let license = await checkForLicense(context, owner, repository.name);
    let citation = await checkForCitation(context, owner, repository.name);
    let codemeta = await checkForCodeMeta(context, owner, repository.name);
    if (fullCodefairRun) {
      cwl = await getCWLFiles(context, owner, repository.name);
    }

    // Check if any of the commits added a LICENSE, CITATION, or codemeta file
    const gatheredCWLFiles = [];
    const removedCWLFiles = [];
    const commitIds = [];
    if (commits.length > 0) {
      for (let i = 0; i < commits.length; i++) {
        if (commits[i]?.added?.length > 0) {
          // Iterate through the added files
          for (let j = 0; j < commits[i]?.added.length; j++) {
            if (commits[i].added[j] === "LICENSE") {
              license = true;
              continue;
            }
            if (commits[i].added[j] === "CITATION.cff") {
              citation = true;
              continue;
            }
            if (commits[i].added[j] === "codemeta.json") {
              codemeta = true;
              continue;
            }
            const fileSplit = commits[i].added[j].split(".");
            if (fileSplit.includes("cwl")) {
              commitIds.push(commits[i].id);
              gatheredCWLFiles.push({
                commitId: commits[i].id,
                filePath: commits[i].added[j],
              });
              continue;
            }
          }
        }
        // Iterate through the modified files
        if (commits[i]?.modified?.length > 0) {
          for (let j = 0; j < commits[i]?.modified.length; j++) {
            const fileSplit = commits[i]?.modified[j].split(".");
            if (fileSplit.includes("cwl")) {
              commitIds.push(commits[i].id);
              gatheredCWLFiles.push({
                commitId: commits[i].id,
                filePath: commits[i].modified[j],
              });
              continue;
            }
          }
        }

        // Iterate through the remove files
        if (commits[i]?.removed?.length > 0) {
          for (let j = 0; j < commits[i]?.removed.length; j++) {
            const fileSplit = commits[i]?.removed[j].split(".");
            if (fileSplit.includes("cwl")) {
              removedCWLFiles.push(commits[i].removed[j]);
              continue;
            }
            if (commits[i]?.removed[j] === "LICENSE") {
              license = false;
              continue;
            }
            if (commits[i]?.removed[j] === "CITATION.cff") {
              citation = false;
              continue;
            }
            if (commits[i]?.removed[j] === "codemeta.json") {
              codemeta = false;
              continue;
            }
          }
        }
      }
    }

    if (gatheredCWLFiles.length > 0) {
      // Begin requesting the file metadata for each file name
      for (const file of gatheredCWLFiles) {
        const cwlFile = await context.octokit.repos.getContent({
          owner,
          path: file.filePath,
          repo: repository.name,
        });

        cwlFile.data.commitId = file.commitId;
        cwl.push(cwlFile.data);
      }
    }

    const cwlObject = {
      contains_cwl: cwl.length > 0 || false,
      files: cwl.filter(file => !removedCWLFiles.includes(file.path)),
      removed_files: removedCWLFiles,
    };

    const cwlExists = await db.cwlValidation.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    // Does the repository already contain CWL files
    if (cwlExists) {
      cwlObject.contains_cwl = cwlExists.contains_cwl_files;
    }

    const subjects = {
      citation,
      codemeta,
      cwl: cwlObject,
      license,
    };

    const issueBody = await renderIssues(
      context,
      owner,
      repository,
      emptyRepo,
      subjects,
    );

    // Update the dashboard issue
    await createIssue(context, owner, repository, ISSUE_TITLE, issueBody);
  });

  // When a pull request is opened
  app.on("pull_request.opened", async (context) => {
    const owner = context.payload.repository.owner.login;
    const { repository } = context.payload;
    const prTitle = context.payload.pull_request.title;
    const prLink = context.payload.pull_request.html_url;
    const definedPRTitles = [
      "feat: ✨ LICENSE file added",
      "feat: ✨ metadata files added",
    ];

    const emptyRepo = await isRepoEmpty(context, owner, repository.name);

    await verifyInstallationAnalytics(context, repository);

    const installation = await db.installation.findUnique({
      where: {
        id: repository.id,
      },
    });

    if (installation?.action_count > 0) {
      db.installation.update({
        data: {
          action_count: {
            set:
              installation.action_count - 1 < 0
                ? 0
                : installation.action_count - 1,
          },
        },
        where: { id: repository.id },
      });
      return;
    }

    if (installation?.action_count === 0) {
      consola.info("Removing action limit for", repository.name);
      db.installation.update({
        data: {
          action_count: 0,
        },
        where: { id: repository.id },
      });
    }

    if (definedPRTitles.includes(prTitle)) {
      const prInfo = {
        title: prTitle,
        link: prLink,
      };

      const license = await checkForLicense(context, owner, repository.name);
      const citation = await checkForCitation(context, owner, repository.name);
      const codemeta = await checkForCodeMeta(context, owner, repository.name);
      const cwl = await getCWLFiles(context, owner, repository.name); // This variable is an array of cwl files

      const cwlObject = {
        contains_cwl: cwl.length > 0 || false,
        files: cwl,
        removed_files: [],
      };

      const cwlExists = await db.cwlValidation.findUnique({
        where: {
          repository_id: repository.id,
        },
      });

      if (cwlExists) {
        cwlObject.contains_cwl = cwlExists.contains_cwl_files;
      }

      const subjects = {
        citation,
        codemeta,
        cwl: cwlObject,
        license,
      };
      // Check if the pull request is for the LICENSE file
      // If it is, close the issue that was opened for the license
      const issueBody = await renderIssues(
        context,
        owner,
        repository,
        emptyRepo,
        subjects,
        prInfo,
      );
      await createIssue(context, owner, repository, ISSUE_TITLE, issueBody);
    }
  });

  // When the issue has been edited
  app.on("issues.edited", async (context) => {
    const issueBody = context.payload.issue.body;
    const issueTitle = context.payload.issue.title;
    const { repository } = context.payload;
    const owner = context.payload.repository.owner.login;

    if (!issueTitle === ISSUE_TITLE) {
      return;
    }

    const installation = await db.installation.findUnique({
      where: {
        id: context.payload.repository.id,
      },
    });

    if (installation) {
      verifyRepoName(
        installation.repo,
        context.payload.repository,
        context.payload.repository.owner.login,
        db.installation,
      );

      if (installation?.action_count > 0) {
        db.installation.update({
          data: {
            action_count: {
              set:
                installation.action_count - 1 < 0
                  ? 0
                  : installation.action_count - 1,
            },
          },
          where: { id: context.payload.repository.id },
        });

        return;
      }

      if (installation?.action_count === 0) {
        db.installation.update({
          data: {
            action_count: 0,
          },
          where: { id: context.payload.repository.id },
        });
      }
    }

    if (
      issueBody.includes("<!-- @codefair-bot rerun-cwl-validation -->")
    ) {
      consola.start("Rerunning CWL Validation...");

      const cwl = await getCWLFiles(context, owner, repository.name);

      // Remove the section from the issue body starting from ## Language Specific Standards
      const slicedBody = issueBody.substring(
        0,
        issueBody.indexOf("## Language Specific Standards"),
      );

      const cwlObject = {
        contains_cwl: cwl.length > 0 || false,
        files: cwl,
        removed_files: [],
      };

      const cwlExists = await db.cwlValidation.findUnique({
        where: {
          repository_id: repository.id,
        },
      });

      if (cwlExists) {
        cwlObject.contains_cwl = cwlExists.contains_cwl_files;

        if (cwlExists.files.length > 0) {
          // Remove the files that are not in cwlObject
          const cwlFilePaths = cwlObject.files.map((file) => file.path);
          cwlObject.removed_files = cwlExists.files.filter((file) => {
            return !cwlFilePaths.includes(file.path);
          });
        }
      }

      const subjects = {
        cwl: cwlObject,
      };

      // This will also update the database
      const updatedIssueBody = await applyCWLTemplate(
        subjects,
        slicedBody,
        repository,
        owner,
        context,
      );

      // Update the issue with the new body
      await context.octokit.issues.update({
        body: updatedIssueBody,
        issue_number: context.payload.issue.number,
        owner,
        repo: repository.name,
      });

      consola.success("CWL Validation rerun successfully!");
    }

    if (
      issueBody.includes("<!-- @codefair-bot rerun-full-repo-validation -->")
    ) {
      consola.start("Rerunning full repository validation...");

      const license = await checkForLicense(context, owner, repository.name);
      const citation = await checkForCitation(context, owner, repository.name);
      const codemeta = await checkForCodeMeta(context, owner, repository.name);
      const cwl = await getCWLFiles(context, owner, repository.name);

      const cwlObject = {
        contains_cwl: cwl.length > 0 || false,
        files: cwl,
        removed_files: [],
      };

      // If existing cwl validation exists, update the contains_cwl value
      const cwlExists = await db.cwlValidation.findUnique({
        where: {
          repository_id: repository.id,
        },
      });

      if (cwlExists?.contains_cwl_files) {
        cwlObject.contains_cwl = cwlExists.contains_cwl_files;

        if (cwlExists.files.length > 0) {
          // Remove the files that are not in cwlObject
          const cwlFilePaths = cwlObject.files.map((file) => file.path);
          cwlObject.removed_files = cwlExists.files.filter((file) => {
            return !cwlFilePaths.includes(file.path);
          });
        }
      }

      const subjects = {
        citation,
        codemeta,
        cwl: cwlObject,
        license,
      };

      const issueBody = await renderIssues(
        context,
        owner,
        repository,
        false,
        subjects,
      );

      await createIssue(context, owner, repository, ISSUE_TITLE, issueBody);
    }

    if (issueBody.includes("<!-- @codefair-bot publish-zenodo")) {
      consola.log("Publishing to Zenodo...");
      // 1. Get the metadata from the repository
      const citationCff = await getCitationContent(context, owner, repository);
      const codemeta = await getCodemetaContent(context, owner, repository);

      // 2. Validate the CITATION.cff and codemeta.json files
      try {
        await validateMetadata(citationCff, "citation")
      } catch (error) {
        consola.error("Error validating the citation:", error);
        return;
      }

      try {
        await validateMetadata(codemeta, "codemeta")
      } catch (error) {
        consola.error("Error validating the codemeta:", error);
        return;
      }

      // Gather the information for the Zenodo deposition provided in the issue body
      const match = issueBody.match(/<!--\s*@codefair-bot\s*publish-zenodo\s*([\s\S]*?)-->/);
      if (!match) {
        throw new Error("Zenodo publish information not found in issue body.");
      }

      let [depositionId, releaseId, tagVersion, userWhoSubmitted] = match[1].trim().split(/\s+/);

      consola.info("Deposition ID:", depositionId);
      consola.info("Release ID:", releaseId);
      consola.info("Tag Version:", tagVersion);
      consola.info("User Who Submitted:", userWhoSubmitted);

      // Update the issue body with everything except passed <!-- @codefair-bot publish-zenodo
      const quickTemplate = issueBody.substring(0, issueBody.indexOf("<!-- @codefair-bot publish-zenodo"));
      consola.warn(quickTemplate);

      // Update the github issue with the removed command
      // Update the issue with the new body
      await context.octokit.issues.update({
        body: quickTemplate,
        issue_number: context.payload.issue.number,
        owner,
        repo: repository.name,
      });
      consola.success("Updated the GitHub Issue!");

      // Fetch the Zenodo token from the database
      const deposition = await db.zenodoToken.findFirst({
        where: {
          user: {
            username: userWhoSubmitted,
          },
        },
        select: {
          token: true,
        }
      });

      if (!deposition) {
        throw new Error(`Deposition with tag ${tagVersion} not found in db.`);
      }

      // Check if the token is valid
      const zenodoToken = deposition.token;
      const zenodoTokenInfo = await fetch(
        `${ZENODO_API_ENDPOINT}/deposit/depositions${depositionId}?access_token=${zenodoToken}`,
        {
          method: "GET",
        },
      );

      if (!zenodoTokenInfo) {
        throw new Error("Zenodo token not found");
      }

      // 3. Create the Zenodo record or get the existing one
      let zenodoDepositionInfo = await getZenodoDepositionInfo(depositionId, zenodoToken);
      
      // consola.warn(zenodoDepositionInfo);
      // 4. Set the bucket URL and DOI
      const newDepositionId = zenodoDepositionInfo.id;
      const bucket_url = zenodoDepositionInfo.links.bucket;
      const zenodoDoi = zenodoDepositionInfo.metadata.prereserve_doi.doi;

      // 5. Update the CITATION.cff and codemeta.json files with the DOI
      await updateMetadataIdentifier(context, owner, repository, zenodoDoi, tagVersion);

      // Gather metadata for Zenodo deposition
      const newZenodoMetadata = await getZenodoMetadata(codemeta.content);
      
      // 6. Update the zenodo deposition metadata
      const depositionWithMetadata = await updateZenodoMetadata(newDepositionId, zenodoToken, newZenodoMetadata);
      consola.warn("Updated the Zenodo deposition metadata:", depositionWithMetadata);

      // Find the release base on the release ID
      let draftRelease;
      try {
        draftRelease = await context.octokit.repos.getRelease({
          owner,
          repo: repository.name,
          release_id: releaseId,
        });
        // consola.warn(draftRelease);
        consola.success("Fetched the draft release successfully!");
      } catch (error) {
        consola.error("Error fetching the draft release:", error);
        return;
      }

      let repositoryArchive;
      try {
        // Download the repository archive from draft release
        const mainBranch = await getDefaultBranch(context, owner, repository.name);
        const { data } = await context.octokit.repos.downloadZipballArchive({
          owner,
          repo: repository.name,
          ref: mainBranch,
        });

        consola.success("Downloaded the repository archive successfully!");
        repositoryArchive = data;
      } catch (error) {
        consola.error("Error downloading the repository archive:", error);
        return;
      }

      const startTime = performance.now();
      const draftAssets = draftRelease.data.assets;
      // consola.warn("draftRelease:", draftRelease.data);
      await uploadReleaseAssetsToZenodo(zenodoToken, draftAssets, repositoryArchive, owner, context, bucket_url, repository, tagVersion);
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      consola.warn("Total duration:", totalDuration);
      
      // 8. Publish the Zenodo deposition
      consola.start("Publishing the Zenodo deposition...", newDepositionId);
      const publishDeposition = await fetch(
        `${ZENODO_API_ENDPOINT}/deposit/depositions/${newDepositionId}/actions/publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${zenodoToken}`,
          },
        },
      );

      if (!publishDeposition.ok) {
        const errorDetails = await publishDeposition.json();
        consola.error("Failed to publish the Zenodo deposition:", errorDetails);
        return;
      }

      if (!publishDeposition.ok) {
        consola.error("Failed to publish the Zenodo deposition:", publishDeposition);
        return;
      }
      consola.success("Zenodo deposition published successfully at:", publishDeposition);

      // Update the release to not be a draft
      await context.octokit.repos.updateRelease({
        owner,
        repo: repository.name,
        release_id: releaseId,
        draft: false,
      });
      consola.success("Updated release to not be a draft!");
      
      // 9. Append to the issueBody that the deposition has been published
      // First remove everything after the ## Fair Software Release
      consola.warn(issueBody);
      const updatedIssueBody = issueBody.substring(0, issueBody.indexOf("## Fair Software Release"));
      
      consola.warn(updatedIssueBody);
      // const badge = `[![DOI](https://sandbox.zenodo.org/badge/DOI/10.5072/zenodo.114954.svg)](https://handle.stage.datacite.org/10.5072/zenodo.114954)`
      const badgeURL = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/release/zenodo`;
      const releaseBadge = `[![Create Release](https://img.shields.io/badge/Create_Release-00bcd4.svg)](${badgeURL})`
      const badge = `[![DOI](https://img.shields.io/badge/DOI-${zenodoDoi}-blue)](${ZENODO_ENDPOINT}/records/${newDepositionId})`;
      const newIssueBody = `${updatedIssueBody}\n\n## Zenodo Deposition ✔️\n***${tagVersion}*** of your software was successfully released on GitHub and archived on Zenodo. You can view the Zenodo archive by clicking the button below:\n\n${badge}\n\nReady to create your next FAIR release? Click the button below:\n\n${releaseBadge}`;
      const finalTemplate = await applyLastModifiedTemplate(newIssueBody, repository, owner, context);
      
      // Update the issue with the new body
      await context.octokit.issues.update({
        body: finalTemplate,
        issue_number: context.payload.issue.number,
        owner,
        repo: repository.name,
      });
      
      consola.success("Updated the GitHub Issue!");
      
      // Update the database with the Zenodo ID and the status
      await db.zenodoDeposition.update({
        data: {
          status: "published",
          zenodo_id: newDepositionId,
          zenodo_metadata: JSON.stringify(newZenodoMetadata),
          existing_zenodo_deposition_id: true,
          last_published_zenodo_doi: zenodoDoi,
        },
        where: {
          repository_id: repository.id,
        }
      });
      consola.success("Updated the Zenodo deposition in the database!");
    }
  });

  // When an issue is deleted or closed
  app.on(["issues.deleted", "issues.closed"], async (context) => {
    const { repository } = context.payload;
    const issueTitle = context.payload.issue.title;

    if (issueTitle === ISSUE_TITLE) {
      // Modify installation collection
      const installation = await db.installation.findUnique({
        where: {
          id: repository.id,
        },
      });

      if (installation) {
        await db.installation.update({
          data: { disabled: true },
          where: { id: repository.id },
        });
      }

      if (context.payload.action === "closed") {
        // Update the body of the issue to reflect that the repository is disabled
        await context.octokit.issues.update({
          body: CLOSED_ISSUE_BODY,
          issue_number: context.payload.issue.number,
          owner: repository.owner.login,
          repo: repository.name,
        });
      }
    }
  });

  // When an issue is reopened
  app.on("issues.reopened", async (context) => {
    const { repository } = context.payload;
    const owner = context.payload.repository.owner.login;
    const issueTitle = context.payload.issue.title;

    if (issueTitle === ISSUE_TITLE) {
      // Check if the repository is empty
      const emptyRepo = await isRepoEmpty(context, owner, repository.name);

      const latestCommitInfo = {};
      if (!emptyRepo) {
        // Get the name of the main branch
        const defaultBranch = await context.octokit.repos.get({
          owner,
          repo: repository.name,
        });

        const mainBranch = defaultBranch.data.default_branch;
        // Gather the latest commit to main info
        const latestCommit = await context.octokit.repos.getCommit({
          owner,
          ref: mainBranch,
          repo: repository.name,
        });

        latestCommitInfo.latest_commit_sha = latestCommit.data.sha || "";
        latestCommitInfo.latest_commit_message =
          latestCommit.data.commit.message || "";
        latestCommitInfo.latest_commit_url = latestCommit.data.html_url || "";
        latestCommitInfo.latest_commit_date =
          latestCommit.data.commit.committer.date || "";
      }

      // Check if entry in installation and analytics collection
      await verifyInstallationAnalytics(
        context,
        repository,
        0,
        latestCommitInfo,
      );

      const license = await checkForLicense(context, owner, repository.name);
      const citation = await checkForCitation(context, owner, repository.name);
      const codemeta = await checkForCodeMeta(context, owner, repository.name);
      const cwl = await getCWLFiles(context, owner, repository.name); // This variable is an array of cwl files

      const cwlObject = {
        contains_cwl: cwl.length > 0 || false,
        files: cwl,
        removed_files: [],
      };

      const cwlExists = await db.cwlValidation.findUnique({
        where: {
          repository_id: repository.id,
        },
      });

      if (cwlExists) {
        cwlObject.contains_cwl = cwlExists.contains_cwl_files;
      }

      const subjects = {
        citation,
        codemeta,
        cwl: cwlObject,
        license,
      };

      const issueBody = await renderIssues(
        context,
        owner,
        repository,
        emptyRepo,
        subjects,
      );

      // Create an issue with the compliance issues
      await createIssue(context, owner, repository, ISSUE_TITLE, issueBody);
    }
  });

  // When a release is published
  // app.on("release.drafted", async (context) => {
  //   // Check if the release was made using the Codefair dashboard
  //   const owner = context.payload.repository.owner.login;
  //   const { repository } = context.payload;

  //   const installation = await db.installation.findUnique({
  //     where: {
  //       id: repository.id,
  //     }
  //   });

  //   if (!installation) {
  //     return;
  //   }
  // })

  // When a comment is made on an issue
  // TODO: Verify if this is still needed, currently does not run due to issue titles being changed
  // app.on("issue_comment.created", async (context) => {
  //   const owner = context.payload.repository.owner.login;
  //   const repoName = context.payload.repository.name;
  //   const userComment = context.payload.comment.body;
  //   const authorAssociation = context.payload.comment.author_association;

  //   if (
  //     context.payload.issue.title ===
  //       `No license file found [${GITHUB_APP_NAME}]` &&
  //     ["MEMBER", "OWNER"].includes(authorAssociation) &&
  //     userComment.includes(GITHUB_APP_NAME)
  //   ) {
  //     // Check the comment to see if the user has replied with a license
  //     const splitComment = userComment.split(" ");
  //     const selection =
  //       splitComment[splitComment.indexOf(`@${GITHUB_APP_NAME} license`) + 1];

  //     // Create a new file with the license on the new branch and open pull request
  //     await createLicense(context, owner, repoName, selection);
  //   }

  //   if (
  //     context.payload.issue.title ===
  //       `No citation file found [${GITHUB_APP_NAME}]` &&
  //     ["MEMBER", "OWNER"].includes(authorAssociation) &&
  //     userComment.includes(GITHUB_APP_NAME)
  //   ) {
  //     if (userComment.includes("Yes")) {
  //       // Gather the information for the CITATION.cff file
  //       await gatherCitationInfo(context, owner, repoName);
  //     }
  //   }

  //   if (
  //     context.payload.issue.title ===
  //       `No codemeta.json file found [${GITHUB_APP_NAME}]` &&
  //     ["MEMBER", "OWNER"].includes(authorAssociation) &&
  //     userComment.includes(GITHUB_APP_NAME)
  //   ) {
  //     if (userComment.includes("Yes")) {
  //       // Gather the information for the codemeta.json file
  //       await gatherCodeMetaInfo(context, owner, repoName);
  //     }
  //   }
  // });
};
