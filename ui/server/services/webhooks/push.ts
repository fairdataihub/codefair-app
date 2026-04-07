import { GitHubRepositoryProvider } from "~/server/services/providers/github";
import { runComplianceChecks } from "~/server/services/compliance/index";
import { createOrUpdateDashboardIssue } from "~/server/services/dashboard/manager";
import { saveLatestCommit } from "~/server/utils/github";
import { logwatch } from "~/server/utils/logwatch";

/**
 * Handles a `push` webhook event.
 * Only acts on pushes to the default branch. Installations with `use_central_api`
 * run the full compliance pipeline; others fall through to the legacy PoC path.
 * @param payload - The raw GitHub webhook payload.
 */
export async function handlePush(payload: any) {
  const owner: string = payload.repository.owner.login;
  const repoName: string = payload.repository.name;
  const defaultBranch: string = payload.repository.default_branch;

  // Only act on pushes to the default branch
  if (payload.ref !== `refs/heads/${defaultBranch}`) {
    logwatch.info(
      `[webhook/push] Ignoring push to non-default branch: ${payload.ref}`,
    );
    return;
  }

  logwatch.info(`[webhook/push] Processing push to ${owner}/${repoName}`);

  const installation = await prisma.installation.findUnique({
    where: { id: payload.repository.id },
  });

  if (!installation || installation.disabled) {
    logwatch.info(
      `[webhook/push] No active installation for ${owner}/${repoName}`,
    );
    return;
  }

  if (!payload.installation?.id) {
    logwatch.error("[webhook/push] Missing installation.id in payload");
    return;
  }

  if (payload.head_commit) {
    await saveLatestCommit(payload.repository.id, {
      date: payload.head_commit.timestamp ?? "",
      message: payload.head_commit.message ?? "",
      sha: payload.head_commit.id ?? "",
      url: payload.head_commit.url ?? "",
    });
  }

  if (installation.use_central_api) {
    try {
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
    } catch (err: any) {
      logwatch.error(
        `[webhook/push] Central API compliance run failed for ${owner}/${repoName}: ${err.message}`,
      );
    }
  }
}
