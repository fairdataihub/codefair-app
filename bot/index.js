// import { MongoClient } from "mongodb";
import * as express from "express";
import {
  renderIssues,
  createIssue,
  applyCWLTemplate,
} from "./utils/renderer/index.js";
import dbInstance from "./db.js";
import {
  checkEnvVariable,
  isRepoEmpty,
  verifyInstallationAnalytics,
  intializeDatabase,
  verifyRepoName,
} from "./utils/tools/index.js";
import { checkForLicense } from "./utils/license/index.js";
import { checkForCitation } from "./utils/citation/index.js";
import { checkForCodeMeta } from "./utils/codemeta/index.js";
import { getCWLFiles } from "./utils/cwl/index.js";

checkEnvVariable("MONGODB_URI");
checkEnvVariable("MONGODB_DB_NAME");
checkEnvVariable("GITHUB_APP_NAME");
checkEnvVariable("CODEFAIR_APP_DOMAIN");

// sourcery skip: use-object-destructuring
// const GITHUB_APP_NAME = process.env.GITHUB_APP_NAME;
const ISSUE_TITLE = `FAIR Compliance Dashboard`;

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default async (app, { getRouter }) => {
  // Connect to the MongoDB database
  await intializeDatabase();

  const db = dbInstance.getDb();
  const ping = db.collection("ping");

  await ping.insertOne({
    timestamp: Date.now(),
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
      const owner = context.payload.installation.account.login;
      let applyActionLimit = false;
      const actionCount = 0;
      let repoCount = 0;
      const repositories =
        context.payload.repositories || context.payload.repositories_added;

      // shows all repos you've installed the app on
      for (const repository of repositories) {
        repoCount++;
        // TODO: Verify if we want to increase amount of actions needed by one every 5 repos
        // if (repoCount % 5 === 0) {
        //   actionCount--;
        // }

        if (repoCount > 5) {
          applyActionLimit = true;
        }

        // Check if the repository is empty
        const emptyRepo = await isRepoEmpty(context, owner, repository.name);

        // Check if entry in installation and analytics collection
        await verifyInstallationAnalytics(
          context,
          repository,
          applyActionLimit,
          actionCount,
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
        const cwlExists = await db.collection("cwlValidation").findOne({
          repositoryId: repository.id,
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
      const installationCollection = db.collection("installation");
      const licenseCollection = db.collection("licenseRequests");
      const metadataCollection = db.collection("codeMetadata");
      const cwlCollection = db.collection("cwlValidation");
      const repositories =
        context.payload.repositories || context.payload.repositories_removed;

      for (const repository of repositories) {
        console.log("Repository removed from db:", repository.name);
        // Check if the installation is already in the database
        const installation = await installationCollection.findOne({
          repositoryId: repository.id,
        });

        const license = await licenseCollection.findOne({
          repositoryId: repository.id,
        });

        const metadata = await metadataCollection.findOne({
          repositoryId: repository.id,
        });

        const cwl = await cwlCollection.findOne({
          repositoryId: repository.id,
        });

        if (installation) {
          // Remove from the database
          await installationCollection.deleteOne({
            repositoryId: repository.id,
          });
        }

        if (license) {
          await licenseCollection.deleteOne({
            repositoryId: repository.id,
          });
        }

        if (metadata) {
          await metadataCollection.deleteOne({
            repositoryId: repository.id,
          });
        }

        if (cwl) {
          await cwlCollection.deleteOne({
            repositoryId: repository.id,
          });
        }
      }
    },
  );

  // When a push is made to a repository
  app.on("push", async (context) => {
    // Event for when a push is made to the repository (listens to all branches)
    const owner = context.payload.repository.owner.login;
    const repository = context.payload.repository;

    // If push is not going to the default branch don't do anything
    if (
      context.payload.ref !==
      `refs/heads/${context.payload.repository.default_branch}`
    ) {
      console.log("Not pushing to default branch");
      return;
    }

    const emptyRepo = await isRepoEmpty(context, owner, repository.name);
    let fullCodefairRun = false;

    const installationCollection = db.collection("installation");
    const installation = await installationCollection.findOne({
      repositoryId: repository.id,
    });

    if (!installation) {
      return;
    } else {
      verifyRepoName(
        installation.repo,
        repository,
        owner,
        installationCollection,
      );

      if (installation?.action && installation?.action_count < 4) {
        installationCollection.updateOne(
          { repositoryId: repository.id },
          { $set: { action_count: installation.action_count + 1 } },
        );

        return;
      }

      if (installation?.action && installation?.action_count >= 4) {
        installationCollection.updateOne(
          { repositoryId: repository.id },
          {
            $set: {
              action: false,
              action_count: installation.action_count + 1,
            },
          },
        );

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
              gatheredCWLFiles.push(commits[i].added[j]);
              continue;
            }
          }
        }
        // Iterate through the modified files
        if (commits[i]?.modified?.length > 0) {
          for (let j = 0; j < commits[i]?.modified.length; j++) {
            const fileSplit = commits[i]?.modified[j].split(".");
            if (fileSplit.includes("cwl")) {
              gatheredCWLFiles.push(commits[i].modified[j]);
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
      for (let i = 0; i < gatheredCWLFiles.length; i++) {
        const cwlFile = await context.octokit.repos.getContent({
          owner,
          path: gatheredCWLFiles[i],
          repo: repository.name,
        });

        cwl.push(cwlFile.data);
      }
    }

    const cwlObject = {
      contains_cwl: cwl.length > 0 || false,
      files: cwl,
      removed_files: removedCWLFiles,
    };

    const cwlExists = await db.collection("cwlValidation").findOne({
      repositoryId: repository.id,
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

    // Update the dashboard issue
    await createIssue(context, owner, repository, ISSUE_TITLE, issueBody);
  });

  // When a pull request is opened
  app.on("pull_request.opened", async (context) => {
    const owner = context.payload.repository.owner.login;
    const repository = context.payload.repository;
    const prTitle = context.payload.pull_request.title;
    const prLink = context.payload.pull_request.html_url;
    const definedPRTitles = [
      "feat: ✨ LICENSE file added",
      "feat: ✨ metadata files added",
    ];

    const emptyRepo = await isRepoEmpty(context, owner, repository.name);

    await verifyInstallationAnalytics(context, repository);

    const installationCollection = db.collection("installation");
    const installation = await installationCollection.findOne({
      repositoryId: repository.id,
    });
    if (installation?.action && installation?.action_count < 4) {
      return;
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

      const cwlExists = await db.collection("cwlValidation").findOne({
        repositoryId: repository.id,
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

    if (issueTitle === ISSUE_TITLE) {
      const installationCollection = db.collection("installation");
      const installation = await installationCollection.findOne({
        repositoryId: context.payload.repository.id,
      });

      if (installation) {
        verifyRepoName(
          installation.repo,
          context.payload.repository,
          context.payload.repository.owner.login,
          installationCollection,
        );

        if (installation?.action && installation?.action_count < 4) {
          installationCollection.updateOne(
            { repositoryId: context.payload.repository.id },
            { $set: { action_count: installation.action_count + 1 } },
          );

          return;
        }

        if (installation?.action_count > 4) {
          installationCollection.updateOne(
            { repositoryId: context.payload.repository.id },
            {
              $set: {
                action: false,
                action_count: installation.action_count + 1,
              },
            },
          );
        }
      }
    }

    if (
      issueBody.includes("<!-- @codefair-bot rerun-cwl-validation -->") &&
      issueTitle === ISSUE_TITLE
    ) {
      const owner = context.payload.repository.owner.login;
      const repository = context.payload.repository;

      const cwl = await getCWLFiles(context, owner, repository.name);

      // Remove the section from the issue body starting from ## CWL Validations
      const slicedBody = issueBody.substring(
        0,
        issueBody.indexOf("## CWL Validations"),
      );

      const cwlObject = {
        contains_cwl: cwl.length > 0 || false,
        files: cwl,
        removed_files: [],
      };

      const cwlExists = await db.collection("cwlValidation").findOne({
        repositoryId: repository.id,
      });

      if (cwlExists) {
        cwlObject.contains_cwl = cwlExists.contains_cwl_files;
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
    }
  });

  // When an issue is deleted or closed
  app.on(["issues.deleted", "issues.closed"], async (context) => {
    const repository = context.payload.repository;
    const issueTitle = context.payload.issue.title;

    if (issueTitle === ISSUE_TITLE) {
      // Modify installation collection
      const installationCollection = db.collection("installation");

      const installation = await installationCollection.findOne({
        repositoryId: repository.id,
      });

      if (installation) {
        await installationCollection.updateOne(
          { repositoryId: repository.id },
          { $set: { disabled: true } },
        );
      }

      if (context.payload.action === "closed") {
        // Update the body of the issue to reflect that the repository is disabled
        const issueBody = `Codefair has been disabled for this repository. If you would like to re-enable it, please reopen this issue.`;

        await context.octokit.issues.update({
          body: issueBody,
          issue_number: context.payload.issue.number,
          owner: repository.owner.login,
          repo: repository.name,
        });
      }
    }
  });

  // When an issue is reopened
  app.on("issues.reopened", async (context) => {
    const repository = context.payload.repository;
    const owner = context.payload.repository.owner.login;
    const issueTitle = context.payload.issue.title;

    if (issueTitle === ISSUE_TITLE) {
      // Check if the installation is already in the database
      const emptyRepo = await isRepoEmpty(context, owner, repository.name);

      // Check if entry in installation and analytics collection
      await verifyInstallationAnalytics(context, repository);

      const license = await checkForLicense(context, owner, repository.name);
      const citation = await checkForCitation(context, owner, repository.name);
      const codemeta = await checkForCodeMeta(context, owner, repository.name);
      const cwl = await getCWLFiles(context, owner, repository.name); // This variable is an array of cwl files

      const cwlObject = {
        contains_cwl: cwl.length > 0 || false,
        files: cwl,
        removed_files: [],
      };

      const cwlExists = await db.collection("cwlValidation").findOne({
        repositoryId: repository.id,
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
