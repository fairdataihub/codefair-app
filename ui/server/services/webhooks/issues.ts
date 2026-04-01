import { GitHubRepositoryProvider } from "~/server/services/providers/github";
import { runComplianceChecks } from "~/server/services/compliance/index";
import { createOrUpdateDashboardIssue } from "~/server/services/dashboard/manager";
import prisma from "~/server/utils/prisma";
import { logwatch } from "~/server/utils/logwatch";

const DASHBOARD_ISSUE_TITLE = "FAIR Compliance Dashboard";

/**
 * Handles an `issues.reopened` webhook event.
 * Only acts when the reopened issue is the bot's own dashboard issue.
 * Clears the `disabled` flag on the installation and re-renders the dashboard.
 * @param payload - The raw GitHub webhook payload.
 */
export async function handleIssueReopened(payload: any) {
  const owner: string = payload.repository.owner.login;
  const repoName: string = payload.repository.name;
  const issueTitle: string = payload.issue.title;
  const issueAuthor: string = payload.issue.user.login;
  const botLogin = `${process.env.GH_APP_NAME}[bot]`;

  if (issueTitle !== DASHBOARD_ISSUE_TITLE || issueAuthor !== botLogin) return;

  const installation = await prisma.installation.findUnique({
    where: { id: payload.repository.id },
  });

  if (!installation || !installation.use_central_api) return;

  try {
    await prisma.installation.update({
      data: { disabled: false },
      where: { id: installation.id },
    });

    const provider = await GitHubRepositoryProvider.create(
      payload.installation.id,
    );
    const subjects = await runComplianceChecks(
      provider,
      owner,
      repoName,
      installation.id,
      { fullCodefairRun: true },
    );
    await createOrUpdateDashboardIssue(
      provider,
      owner,
      repoName,
      installation.id,
      subjects,
    );
    logwatch.success(
      `[webhook/issues.reopened] Dashboard re-rendered for ${owner}/${repoName}`,
    );
  } catch (err: any) {
    logwatch.error(
      `[webhook/issues.reopened] Failed for ${owner}/${repoName}: ${err.message}`,
    );
  }
}

/**
 * Handles an `issues.closed` webhook event.
 * Only acts when the closed issue is the bot's own dashboard issue.
 * Sets the `disabled` flag so re-render attempts are skipped until reopened.
 * @param payload - The raw GitHub webhook payload.
 */
export async function handleIssueClosed(payload: any) {
  const owner: string = payload.repository.owner.login;
  const repoName: string = payload.repository.name;
  const issueTitle: string = payload.issue.title;
  const issueAuthor: string = payload.issue.user.login;
  const botLogin = `${process.env.GH_APP_NAME}[bot]`;

  if (issueTitle !== DASHBOARD_ISSUE_TITLE || issueAuthor !== botLogin) return;

  const installation = await prisma.installation.findUnique({
    where: { id: payload.repository.id },
  });

  if (!installation || !installation.use_central_api) return;

  try {
    await prisma.installation.update({
      data: { disabled: true },
      where: { id: installation.id },
    });
    logwatch.info(
      `[webhook/issues.closed] Dashboard disabled for ${owner}/${repoName}`,
    );
  } catch (err: any) {
    logwatch.error(
      `[webhook/issues.closed] Failed for ${owner}/${repoName}: ${err.message}`,
    );
  }
}
