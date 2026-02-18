import { runComplianceChecks } from "../compliance-checks/index.js";
import { renderIssues, createIssue } from "../utils/renderer/index.js";
import {
  isRepoEmpty,
  verifyRepoName,
  verifyInstallationAnalytics,
  gatherCommitDetails,
  disableCodefairOnRepo,
} from "../utils/tools/index.js";
import { ISSUE_TITLE, createEmptyCommitInfo } from "../utils/helpers.js";
import { logwatch } from "../utils/logwatch.js";
import {
  publishToZenodo,
  reRenderDashboard,
} from "../commands/actions/index.js";
import {
  rerunCodeOfConductValidation,
  rerunContributingValidation,
  rerunCWLValidation,
  rerunFullRepoValidation,
  rerunLicenseValidation,
  rerunMetadataValidation,
  rerunReadmeValidation,
} from "../commands/validations/index.js";

const { GH_APP_NAME } = process.env;

// Data-driven command routing for issue body triggers
const COMMANDS = [
  {
    trigger: "<!-- @codefair-bot rerun-cwl-validation -->",
    handler: rerunCWLValidation,
  },
  {
    trigger: "<!-- @codefair-bot rerun-contributing-validation -->",
    handler: rerunContributingValidation,
  },
  {
    trigger: "<!-- @codefair-bot rerun-code-of-conduct-validation -->",
    handler: rerunCodeOfConductValidation,
  },
  {
    trigger: "<!-- @codefair-bot rerun-full-repo-validation -->",
    handler: rerunFullRepoValidation,
  },
  {
    trigger: "<!-- @codefair-bot rerun-license-validation -->",
    handler: rerunLicenseValidation,
  },
  {
    trigger: "<!-- @codefair-bot rerun-metadata-validation -->",
    handler: rerunMetadataValidation,
  },
  {
    trigger: "<!-- @codefair-bot rerun-readme-validation -->",
    handler: rerunReadmeValidation,
  },
  {
    trigger: "<!-- @codefair-bot publish-zenodo",
    handler: publishToZenodo,
  },
  {
    trigger: "<!-- @codefair-bot re-render-dashboard -->",
    handler: reRenderDashboard,
  },
];

/**
 * Registers issue event handlers
 * @param {import('probot').Probot} app
 * @param {import('@prisma/client').PrismaClient} db
 */
export function registerIssueHandlers(app, db) {
  // When the issue has been edited
  app.on("issues.edited", async (context) => {
    const issueBody = context.payload.issue.body;
    const issueTitle = context.payload.issue.title;
    const { repository } = context.payload;
    const owner = context.payload.repository.owner.login;
    const potentialBot = context.payload.sender.login;

    // Return if the issue title is not FAIR Compliance Dashboard or the sender is not the bot
    if (issueTitle !== ISSUE_TITLE || potentialBot !== `${GH_APP_NAME}[bot]`) {
      logwatch.info(
        "issues.edited: Issue title is not FAIR Compliance Dashboard or the editor is not the bot, ignoring..."
      );
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
      if (installation?.action_count > 0 || installation?.disabled) {
        await db.installation.update({
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

    // Data-driven command routing with early return
    for (const { trigger, handler } of COMMANDS) {
      if (issueBody.includes(trigger)) {
        await handler(context, owner, repository, issueBody);
        return;
      }
    }
  });

  // When an issue is closed
  app.on(["issues.closed"], async (context) => {
    const issueTitle = context.payload.issue.title;
    const botAuthor = context.payload.issue.user.login;

    // Only proceed if the issue was created by the bot
    if (botAuthor !== `${GH_APP_NAME}[bot]`) {
      return;
    }

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
    const issueAuthor = context.payload.issue.user.login;

    if (issueTitle === ISSUE_TITLE && issueAuthor === `${GH_APP_NAME}[bot]`) {
      // Check if the repository is empty
      const emptyRepo = await isRepoEmpty(context, owner, repository.name);

      // remove disabled flag if it exists
      await db.installation.update({
        data: {
          disabled: false,
        },
        where: { id: repository.id },
      });

      let latestCommitInfo = createEmptyCommitInfo();
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
      const subjects = await runComplianceChecks(context, owner, repository);

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
}
