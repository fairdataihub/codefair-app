import { runComplianceChecks } from "../compliance-checks/index.js";
import { renderIssues, createIssue } from "../utils/renderer/index.js";
import {
  isRepoEmpty,
  verifyRepoName,
  iterateCommitDetails,
  ignoreCommitMessage,
} from "../utils/tools/index.js";
import { ISSUE_TITLE } from "../utils/helpers.js";
import { logwatch } from "../utils/logwatch.js";

/**
 * Registers push event handler
 * @param {import('probot').Probot} app
 * @param {import('@prisma/client').PrismaClient} db
 */
export function registerPushHandler(app, db) {
  app.on("push", async (context) => {
    // Event for when a push is made to the repository (listens to all branches)
    const owner = context.payload.repository.owner.login;
    const { repository } = context.payload;
    logwatch.info(`Push made to ${repository.name}`);

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

    if (!installation || installation.disabled) {
      return;
    } else {
      // Verify if repository name has changed and update commit details to db
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
      context.payload.head_commit.author.username,
      repository,
      { citation: true, codemeta: true },
      owner,
      context
    );
    if (ignoreBotEvent) {
      return;
    }

    // Grab the commits being pushed
    const { commits } = context.payload;

    let subjects = await runComplianceChecks(
      context,
      owner,
      repository,
      fullCodefairRun
    );

    // Check if any of the commits added a LICENSE, CITATION, CWL files, or codemeta file
    if (commits.length > 0) {
      subjects = await iterateCommitDetails(
        commits,
        subjects,
        repository,
        context,
        owner
      );
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
}
