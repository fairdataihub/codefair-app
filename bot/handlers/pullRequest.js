import { reRenderDashboard } from "../commands/actions/index.js";
import { PR_TITLES } from "../utils/helpers.js";
import { logwatch } from "../utils/logwatch.js";

const { GH_APP_NAME } = process.env;

/**
 * Registers pull request event handlers
 * @param {import('probot').Probot} app
 * @param {import('@prisma/client').PrismaClient} db
 */
export function registerPullRequestHandlers(app, db) {
  // When a pull request is opened
  app.on("pull_request.opened", async (context) => {
    const owner = context.payload.repository.owner.login;
    const { repository } = context.payload;
    const prTitle = context.payload.pull_request.title;
    const prLink = context.payload.pull_request.html_url;

    // Skip non-bot PRs
    if (!Object.values(PR_TITLES).includes(prTitle)) {
      return;
    }

    // Verify installation exists and is not rate-limited or disabled
    const installation = await db.installation.findUnique({
      where: { id: repository.id },
    });

    if (!installation) {
      logwatch.error("Installation not found for repository");
      return;
    }

    if (installation.action_count > 0 || installation.disabled) {
      logwatch.info(
        `pull_request.opened: Action limit at ${installation.action_count} or disabled, ignoring...`
      );
      return;
    }

    // Store PR URL in database
    if (prTitle === PR_TITLES.license) {
      const response = await db.licenseRequest.update({
        data: { pull_request_url: prLink },
        where: { repository_id: repository.id },
      });

      if (!response) {
        logwatch.error("Error updating the license request PR URL");
        return;
      }
    } else {
      // Metadata PR (add or update)
      const response = await db.codeMetadata.update({
        data: { pull_request_url: prLink },
        where: { repository_id: repository.id },
      });

      if (!response) {
        logwatch.error("Error updating the code metadata PR URL");
        return;
      }
    }

    // Re-render dashboard from database (no compliance checks needed - code hasn't merged yet)
    logwatch.info("PR opened, re-rendering dashboard to show PR badge");
    await reRenderDashboard(context, owner, repository, "");
  });

  // When a pull request is closed
  app.on("pull_request.closed", async (context) => {
    // Only handle bot PRs
    if (context.payload.pull_request.user.login !== `${GH_APP_NAME}[bot]`) {
      return;
    }

    const owner = context.payload.repository.owner.login;
    const { repository } = context.payload;
    const prTitle = context.payload.pull_request.title;

    // Clear PR URL from database based on PR type
    if (prTitle === PR_TITLES.license) {
      const response = await db.licenseRequest.update({
        data: { pull_request_url: "" },
        where: { repository_id: repository.id },
      });

      if (!response) {
        logwatch.error("Error clearing the license request PR URL");
        return;
      }
    } else if (
      prTitle === PR_TITLES.metadataAdd ||
      prTitle === PR_TITLES.metadataUpdate
    ) {
      const response = await db.codeMetadata.update({
        data: { pull_request_url: "" },
        where: { repository_id: repository.id },
      });

      if (!response) {
        logwatch.error("Error clearing the code metadata PR URL");
        return;
      }
    }

    // Re-render dashboard from database (no compliance checks needed)
    // If PR was merged, the push event will trigger full compliance checks
    // If PR was closed without merge, we just need to remove the PR badge
    logwatch.info("PR closed, re-rendering dashboard to remove PR badge");
    await reRenderDashboard(context, owner, repository, "");

    // Delete the branch
    const branchName = context.payload.pull_request.head.ref;
    await context.octokit.git.deleteRef({
      owner,
      ref: `heads/${branchName}`,
      repo: repository.name,
    });
  });
}
