import { GitHubRepositoryProvider } from "~/server/services/providers/github";
import { refreshDashboardFromDb } from "~/server/services/dashboard/manager";
import prisma from "~/server/utils/prisma";
import { logwatch } from "~/server/utils/logwatch";

// PR titles the bot creates — mirrors bot/utils/helpers.js PR_TITLES
const PR_TITLE_LICENSE = "feat: ✨ LICENSE file added";
const PR_TITLE_METADATA_ADD = "feat: ✨ Add code metadata files";
const PR_TITLE_METADATA_UPDATE = "feat: ✨ Update code metadata files";
const PR_TITLE_README_ADD = "feat: ✨ README file added";
const PR_TITLE_README_UPDATE = "feat: ✨ README file updated";
const PR_TITLE_CODE_OF_CONDUCT_ADD = "feat: ✨ CODE_OF_CONDUCT.md file added";
const PR_TITLE_CODE_OF_CONDUCT_UPDATE =
  "feat: ✨ CODE_OF_CONDUCT.md file updated";
const PR_TITLE_CONTRIBUTING_ADD = "feat: ✨ CONTRIBUTING.md file added";
const PR_TITLE_CONTRIBUTING_UPDATE = "feat: ✨ CONTRIBUTING.md file updated";

// Maps each bot PR title to the Prisma updater for that model
type PrUrlData = { pull_request_url: string };
const PR_TITLE_TO_MODEL: Record<
  string,
  (repoId: number, data: PrUrlData) => Promise<any>
> = {
  [PR_TITLE_LICENSE]: (id, data) =>
    prisma.licenseRequest.updateMany({ data, where: { repository_id: id } }),
  [PR_TITLE_METADATA_ADD]: (id, data) =>
    prisma.codeMetadata.updateMany({ data, where: { repository_id: id } }),
  [PR_TITLE_METADATA_UPDATE]: (id, data) =>
    prisma.codeMetadata.updateMany({ data, where: { repository_id: id } }),
  [PR_TITLE_README_ADD]: (id, data) =>
    prisma.readmeValidation.updateMany({ data, where: { repository_id: id } }),
  [PR_TITLE_README_UPDATE]: (id, data) =>
    prisma.readmeValidation.updateMany({ data, where: { repository_id: id } }),
  [PR_TITLE_CODE_OF_CONDUCT_ADD]: (id, data) =>
    prisma.codeofConductValidation.updateMany({
      data,
      where: { repository_id: id },
    }),
  [PR_TITLE_CODE_OF_CONDUCT_UPDATE]: (id, data) =>
    prisma.codeofConductValidation.updateMany({
      data,
      where: { repository_id: id },
    }),
  [PR_TITLE_CONTRIBUTING_ADD]: (id, data) =>
    prisma.contributingValidation.updateMany({
      data,
      where: { repository_id: id },
    }),
  [PR_TITLE_CONTRIBUTING_UPDATE]: (id, data) =>
    prisma.contributingValidation.updateMany({
      data,
      where: { repository_id: id },
    }),
};

/**
 * Handles `pull_request.closed` webhook events.
 * Only processes PRs whose titles match our bot-created PR titles.
 * On close, clears the PR URL in the DB, deletes the feature branch, and
 * re-renders the dashboard from existing DB state (no compliance re-check).
 * Merged PRs are skipped since the push event will trigger a full compliance check and render.
 * @param payload - The raw GitHub webhook payload.
 */
export async function handlePullRequest(payload: any) {
  const owner: string = payload.repository.owner.login;
  const repoName: string = payload.repository.name;
  const prTitle: string = payload.pull_request.title;
  const action: string = payload.action; // "closed"

  // Only care about bot-created PRs
  if (!(prTitle in PR_TITLE_TO_MODEL)) return;

  const installation = await prisma.installation.findUnique({
    where: { id: payload.repository.id },
  });

  if (!installation || installation.disabled || !installation.use_central_api) {
    return;
  }

  if (!payload.installation?.id) {
    logwatch.error("[webhook/pull_request] Missing installation.id in payload");
    return;
  }

  try {
    const provider = await GitHubRepositoryProvider.create(
      payload.installation.id,
    );

    const updatePrUrl = PR_TITLE_TO_MODEL[prTitle];
    if (action === "closed") {
      // Guard: only handle PRs created by the bot
      const botLogin = `${process.env.GH_APP_NAME}[bot]`;
      if (payload.pull_request.user.login !== botLogin) return;

      await updatePrUrl(installation.id, { pull_request_url: "" });

      // Delete the feature branch
      const branchName: string = payload.pull_request.head.ref;
      try {
        await provider.deleteBranch(owner, repoName, branchName);
      } catch (branchErr: any) {
        logwatch.warn(
          `[webhook/pull_request.closed] Branch delete failed for ${owner}/${repoName} (may already be gone): ${branchErr.message}`,
        );
      }

      // Merged PRs: the push event fires immediately after and handles the re-render
      if (payload.pull_request.merged === true) return;
    }

    // Re-render the dashboard to reflect the cleared PR badge.
    // Compliance state hasn't changed — only the PR URL — so we skip
    // the file-scan checks and render directly from existing DB state.
    await refreshDashboardFromDb(provider, owner, repoName, installation.id);
    logwatch.success(
      `[webhook/pull_request.${action}] Dashboard re-rendered for ${owner}/${repoName}`,
    );
  } catch (err: any) {
    logwatch.error(
      `[webhook/pull_request.${action}] Handler failed for ${owner}/${repoName}: ${err.message}`,
    );
  }
}
