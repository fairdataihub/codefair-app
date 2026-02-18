import { runComplianceChecks } from "../compliance-checks/index.js";
import { renderIssues, createIssue } from "../utils/renderer/index.js";
import {
  isRepoEmpty,
  verifyInstallationAnalytics,
  gatherCommitDetails,
  purgeDBEntry,
} from "../utils/tools/index.js";
import { ISSUE_TITLE, createEmptyCommitInfo } from "../utils/helpers.js";
import { logwatch } from "../utils/logwatch.js";

/**
 * Registers installation-related event handlers
 * @param {import('probot').Probot} app
 * @param {import('@prisma/client').PrismaClient} db
 */
export function registerInstallationHandlers(app, db) {
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

        let latestCommitInfo = createEmptyCommitInfo();
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

        let subjects;
        if (!emptyRepo) {
          // BEGIN CHECKING FOR COMPLIANCE
          subjects = await runComplianceChecks(context, owner, repository);
        }

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

  // When the app is uninstalled or removed from a repository
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
}
