"use strict";

import * as express from "express";
import { checkForCompliance } from "./utils/compliance-checks/index.js";
import { renderIssues, createIssue } from "./utils/renderer/index.js";
import dbInstance from "./db.js";
import { logwatch } from "./utils/logwatch.js";
import {
  checkEnvVariable,
  isRepoEmpty,
  verifyInstallationAnalytics,
  intializeDatabase,
  verifyRepoName,
  applyLastModifiedTemplate,
  getDefaultBranch,
  getReleaseById,
  downloadRepositoryZip,
  iterateCommitDetails,
  ignoreCommitMessage,
  gatherCommitDetails,
  purgeDBEntry,
  disableCodefairOnRepo,
} from "./utils/tools/index.js";
import { checkForLicense, validateLicense } from "./license/index.js";
import { checkForCitation } from "./citation/index.js";
import { checkForCodeMeta } from "./codemeta/index.js";
import { getCWLFiles, applyCWLTemplate } from "./cwl/index.js";
import {
  getZenodoDepositionInfo,
  createZenodoMetadata,
  updateZenodoMetadata,
  uploadReleaseAssetsToZenodo,
  parseZenodoInfo,
  getZenodoToken,
  publishZenodoDeposition,
  updateGitHubRelease,
} from "./archival/index.js";
import {
  validateMetadata,
  getCitationContent,
  getCodemetaContent,
  updateMetadataIdentifier,
  gatherMetadata,
  convertDateToUnix,
  applyDbMetadata,
  applyCodemetaMetadata,
  applyCitationMetadata,
} from "./metadata/index.js";
import {
  publishToZenodo,
  reRenderDashboard,
} from "./commands/actions/index.js";
import {
  rerunCWLValidation,
  rerunFullRepoValidation,
  rerunLicenseValidation,
  rerunMetadataValidation,
} from "./commands/validations/index.js";

checkEnvVariable("GH_APP_NAME");
checkEnvVariable("CODEFAIR_APP_DOMAIN");

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
const ISSUE_TITLE = `FAIR Compliance Dashboard`;
const CLOSED_ISSUE_BODY = `Codefair has been disabled for this repository. If you would like to re-enable it, please reopen this issue.`;
const BOT_MADE_PR_TITLES = [
  "feat: ✨ LICENSE file added",
  "feat: ✨ Add code metadata files",
  "feat: ✨ Update code metadata files",
];
const { ZENODO_ENDPOINT, ZENODO_API_ENDPOINT, GH_APP_NAME } = process.env;

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
    logwatch.info("Requested healthcheck");
    res.status(200).send("Health check passed");
  });

  // for kamal
  router.get("/up", (req, res) => {
    logwatch.info("Requested healthcheck");
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
          logwatch.info(`Applying action limit to ${repository.name}`);
          applyActionLimit = true;
          actionCount = 5;
        }

        // Check if the repository is empty
        const emptyRepo = await isRepoEmpty(context, owner, repository.name);

        let latestCommitInfo = {
          latest_commit_sha: "",
          latest_commit_message: "",
          latest_commit_url: "",
          latest_commit_date: "",
        };
        if (!emptyRepo) {
          latestCommitInfo = await gatherCommitDetails(
            context,
            owner,
            repository
          );
        }

        // Check if entry in installation and analytics collection
        await verifyInstallationAnalytics(
          context,
          repository,
          actionCount,
          latestCommitInfo
        );

        if (applyActionLimit) {
          // Do nothing but add repo to db, after the first 5 repos, the action count will determine when to handle the rest
          continue;
        }

        // BEGIN CHECKING FOR COMPLIANCE
        const subjects = await checkForCompliance(
          context,
          owner,
          repository.name
        );

        // Create issue body template
        const issueBody = await renderIssues(
          context,
          owner,
          repository,
          emptyRepo,
          subjects
        );

        // Create an issue with the compliance issues body
        await createIssue(context, owner, repository, ISSUE_TITLE, issueBody);
      }
    }
  );

  // When the app is uninstalled or removed from a repository (difference between installation.deleted and installation_repositories.removed is that the former is for the entire installation and the latter is for a specific repository)
  app.on(
    ["installation.deleted", "installation_repositories.removed"],
    async (context) => {
      const repositories =
        context.payload.repositories || context.payload.repositories_removed;

      if (!repositories) {
        throw new Error("No repositories found in the payload");
      }

      for (const repository of repositories) {
        await purgeDBEntry(repository);
      }
    }
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
      logwatch.info("Not pushing to default branch, ignoring...");
      return;
    }

    const emptyRepo = await isRepoEmpty(context, owner, repository.name);

    const latestCommitInfo = {
      latest_commit_date: context.payload.head_commit.timestamp || "",
      latest_commit_message: context.payload.head_commit.message || "",
      latest_commit_sha: context.payload.head_commit.id || "",
      latest_commit_url: context.payload.head_commit.url || "",
    };

    let fullCodefairRun = false;

    const installation = await db.installation.findUnique({
      where: {
        id: repository.id,
      },
    });

    if (!installation) {
      return;
    } else {
      // Verify if repository name has changed
      verifyRepoName(installation.repo, repository, owner, db.installation);

      if (installation?.action_count > 0) {
        const response = await db.installation.update({
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

        if (installation?.action_count === 0) {
          fullCodefairRun = true;
        }
      } else {
        await db.installation.update({
          data: {
            latest_commit_date: latestCommitInfo.latest_commit_date,
            latest_commit_message: latestCommitInfo.latest_commit_message,
            latest_commit_sha: latestCommitInfo.latest_commit_sha,
            latest_commit_url: latestCommitInfo.latest_commit_url,
          },
          where: { id: repository.id },
        });
      }
    }

    // Check if the author of the commit is the bot
    // Ignore pushes when bot updates the metadata files
    const ignoreBotEvent = await ignoreCommitMessage(
      latestCommitInfo.latest_commit_message,
      context.payload.head_commit.author
    );
    if (ignoreBotEvent) {
      return;
    }

    // Grab the commits being pushed
    const { commits } = context.payload;

    let subjects = await checkForCompliance(
      context,
      owner,
      repository.name,
      fullCodefairRun
    );

    // Check if any of the commits added a LICENSE, CITATION, CWL files, or codemeta file
    if (commits.length > 0) {
      subjects = await iterateCommitDetails(commits, subjects, repository);
    }
    const issueBody = await renderIssues(
      context,
      owner,
      repository,
      emptyRepo,
      subjects
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

    const emptyRepo = await isRepoEmpty(context, owner, repository.name);

    // Get the latest commit information if repo is not empty
    let latestCommitInfo = {
      latest_commit_sha: "",
      latest_commit_message: "",
      latest_commit_url: "",
      latest_commit_date: "",
    };
    if (!emptyRepo) {
      latestCommitInfo = await gatherCommitDetails(context, owner, repository);
    }

    await verifyInstallationAnalytics(context, repository, 0, latestCommitInfo);

    // Verify existing action count to determine if the PR should be processed
    const installation = await db.installation.findUnique({
      where: {
        id: repository.id,
      },
    });
    if (installation && installation?.action_count > 0) {
      logwatch.info(
        `pull_request.opened: Action limit is at ${installation.action_count} still applied, ignoring...`
      );
      return;
    }

    // Seach for the issue with the title FAIR Compliance Dashboard and authored with the github bot
    const issues = await context.octokit.issues.listForRepo({
      creator: `${GH_APP_NAME}[bot]`,
      owner,
      repo: repository.name,
      state: "open",
    });

    // Find the issue with the exact title "FAIR Compliance Dashboard"
    const dashboardIssue = issues.data.find(
      (issue) => issue.title === "FAIR Compliance Dashboard"
    );

    if (!dashboardIssue) {
      logwatch.error("FAIR Compliance Dashboard issue not found");
      return;
    }

    // Get the current body of the issue
    let issueBody = dashboardIssue.body;

    if (BOT_MADE_PR_TITLES.includes(prTitle)) {
      if (prTitle === "feat: ✨ LICENSE file added") {
        // Add pr link to db
        const response = await db.licenseRequest.update({
          data: {
            pull_request_url: prLink,
          },
          where: {
            repository_id: repository.id,
          },
        });

        if (!response) {
          logwatch.error("Error updating the license request PR URL");
          return;
        }

        // Define the PR badge markdown for the LICENSE section
        const licensePRBadge = `A pull request for the LICENSE file is open. You can view the pull request:\n\n[![License](https://img.shields.io/badge/View_PR-6366f1.svg)](${prLink})`;

        // Append the PR badge after the edit License link in issue text body
        issueBody = issueBody.replace(
          `(${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/license)`,
          `(${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/license)\n\n${licensePRBadge}`
        );
      }

      if (
        prTitle === "feat: ✨ Add code metadata files" ||
        prTitle === "feat: ✨ Update code metadata files"
      ) {
        const response = await db.codeMetadata.update({
          data: {
            pull_request_url: prLink,
          },
          where: {
            repository_id: repository.id,
          },
        });

        if (!response) {
          logwatch.error("Error updating the code metadata PR URL");
          return;
        }

        // Define the replacement string with the new metadata PR badge
        const metadataPRBadge = `A pull request for the metadata files is open. You can view the pull request:\n\n[![Metadata](https://img.shields.io/badge/View_PR-6366f1.svg)](${prLink})`;

        // Perform the replacement while preserving the identifier
        issueBody = issueBody.replace(
          `(${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/code-metadata)`,
          `(${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/code-metadata)\n\n${metadataPRBadge}`
        );
      }

      // Update the issue with the new body
      await createIssue(context, owner, repository, ISSUE_TITLE, issueBody);
    }
  });

  // When the issue has been edited
  app.on("issues.edited", async (context) => {
    const issueBody = context.payload.issue.body;
    const issueTitle = context.payload.issue.title;
    const { repository } = context.payload;
    const owner = context.payload.repository.owner.login;
    const potentialBot = context.payload.sender.login;

    // Return if the issue title is not FAIR Compliance Dashboard or the sender is not the bot
    if (issueTitle != ISSUE_TITLE && potentialBot != `${GH_APP_NAME}[bot]`) {
      return;
    }

    const installation = await db.installation.findUnique({
      where: {
        id: context.payload.repository.id,
      },
    });

    if (installation) {
      // Verify for repository name change
      verifyRepoName(
        installation.repo,
        context.payload.repository,
        context.payload.repository.owner.login,
        db.installation
      );

      // Update the action count if it is greater than 0
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
    }

    // "API" using comments to trigger workflows
    if (issueBody.includes("<!-- @codefair-bot rerun-cwl-validation -->")) {
      await rerunCWLValidation(context, owner, repository, issueBody);
    }

    if (
      issueBody.includes("<!-- @codefair-bot rerun-full-repo-validation -->")
    ) {
      await rerunFullRepoValidation(context, owner, repository, issueBody);
    }

    if (issueBody.includes("<!-- @codefair-bot rerun-license-validation -->")) {
      await rerunLicenseValidation(context, owner, repository, issueBody);
    }

    if (
      issueBody.includes("<!-- @codefair-bot rerun-metadata-validation -->")
    ) {
      await rerunMetadataValidation(context, owner, repository, issueBody);
    }

    if (issueBody.includes("<!-- @codefair-bot publish-zenodo")) {
      await publishToZenodo(context, owner, repository, issueBody);
    }

    if (issueBody.includes("<!-- @codefair-bot re-render-dashboard -->")) {
      await reRenderDashboard(context, owner, repository, issueBody);
    }
  });

  // When an issue is deleted or closed
  app.on(["issues.deleted", "issues.closed"], async (context) => {
    const issueTitle = context.payload.issue.title;

    // Verify the issue dashboard is the one that got close/deleted
    if (issueTitle === ISSUE_TITLE) {
      await disableCodefairOnRepo(context);
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

      let latestCommitInfo = {
        latest_commit_sha: "",
        latest_commit_message: "",
        latest_commit_url: "",
        latest_commit_date: "",
      };
      // Get latest commit info if repository isn't empty
      if (!emptyRepo) {
        // Get the name of the main branch
        latestCommitInfo = await gatherCommitDetails(
          context,
          owner,
          repository
        );
      }

      // Check if entry in installation and analytics collection
      await verifyInstallationAnalytics(
        context,
        repository,
        0,
        latestCommitInfo
      );

      // Begin fair compliance checks
      const subjects = await checkForCompliance(
        context,
        owner,
        repository.name
      );

      const issueBody = await renderIssues(
        context,
        owner,
        repository,
        emptyRepo,
        subjects
      );

      // Create an issue with the compliance issues
      await createIssue(context, owner, repository, ISSUE_TITLE, issueBody);
    }
  });

  app.on("pull_request.closed", async (context) => {
    // If pull request created by the bot, continue with workflow
    if (context.payload.pull_request.user.login === `${GH_APP_NAME}[bot]`) {
      // Remove the PR url from the database
      const prLink = context.payload.pull_request.html_url;
      const owner = context.payload.repository.owner.login;
      const { repository } = context.payload;

      // Seach for the issue with the title FAIR Compliance Dashboard and authored with the github bot
      const issues = await context.octokit.issues.listForRepo({
        creator: `${GH_APP_NAME}[bot]`,
        owner,
        repo: repository.name,
        state: "open",
      });

      // Find the issue with the exact title "FAIR Compliance Dashboard"
      const dashboardIssue = issues.data.find(
        (issue) => issue.title === "FAIR Compliance Dashboard"
      );

      if (!dashboardIssue) {
        logwatch.error("FAIR Compliance Dashboard issue not found");
        return;
      }

      // Get the current body of the issue
      let issueBody = dashboardIssue.body;

      if (
        context.payload.pull_request.title ===
          "feat: ✨ Add code metadata files" ||
        context.payload.pull_request.title ===
          "feat: ✨ Update code metadata files"
      ) {
        const response = await db.codeMetadata.update({
          data: {
            pull_request_url: "",
          },
          where: {
            repository_id: context.payload.repository.id,
          },
        });

        if (!response) {
          logwatch.error("Error updating the license request PR URL");
          return;
        }

        const metadataPRBadge = `A pull request for the metadata files is open. You can view the pull request:\n\n[![Metadata](https://img.shields.io/badge/View_PR-6366f1.svg)](${prLink})`;

        // Append the Metadata PR badge after the "Metadata" section
        issueBody = issueBody.replace(
          `(${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/code-metadata)\n\n${metadataPRBadge}`,
          `(${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/code-metadata)`
        );
      }

      if (
        context.payload.pull_request.title === "feat: ✨ LICENSE file added"
      ) {
        const response = await db.licenseRequest.update({
          data: {
            pull_request_url: "",
          },
          where: {
            repository_id: context.payload.repository.id,
          },
        });

        // Define the PR badge markdown for the LICENSE section
        const licensePRBadge = `A pull request for the LICENSE file is open. You can view the pull request:\n\n[![License](https://img.shields.io/badge/View_PR-6366f1.svg)](${prLink})`;

        // Append the PR badge after the "LICENSE ❌" section
        issueBody = issueBody.replace(
          `[![License](https://img.shields.io/badge/Add_License-dc2626.svg)](${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/license)\n\n${licensePRBadge}`,
          `\n\n[![License](https://img.shields.io/badge/Add_License-dc2626.svg)](${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/license)`
        );
      }

      // Update the issue with the new body
      await createIssue(context, owner, repository, ISSUE_TITLE, issueBody);

      // Delete the branch name from GitHub
      const branchName = context.payload.pull_request.head.ref;
      await context.octokit.git.deleteRef({
        owner,
        ref: `heads/${branchName}`,
        repo: repository.name,
      });
    }
  });
};
