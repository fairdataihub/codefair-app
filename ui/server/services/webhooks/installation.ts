import { GitHubRepositoryProvider } from "~/server/services/providers/github";
import { runComplianceChecks } from "~/server/services/compliance/index";
import { createOrUpdateDashboardIssue } from "~/server/services/dashboard/manager";
import prisma from "~/server/utils/prisma";
import { saveLatestCommit } from "~/server/utils/github";
import { logwatch } from "~/server/utils/logwatch";

/**
 * Handles a `installation.created` or `installation_repositories.added` webhook event.
 * Upserts an Installation + Analytics record for each repository and runs an initial
 * compliance check. Repositories beyond the first 3 have their action count capped to
 * avoid overwhelming the API on large bulk installs.
 * @param payload - The raw GitHub webhook payload.
 */
export async function handleInstallationAdded(payload: any) {
  const repositories: any[] =
    payload.repositories ?? payload.repositories_added ?? [];
  const owner: string = payload.installation.account.login;
  const installationId: number = payload.installation.id;

  let repoCount = 0;

  for (const repo of repositories) {
    repoCount++;
    const applyActionLimit = repoCount > 10;
    const actionCount = applyActionLimit ? 3 : 0;

    const logCtx = {
      action: "installation.added",
      installationId,
      owner,
      repo: repo.name,
    };

    logwatch.info({ ...logCtx, message: "Processing repository" });

    try {
      const provider = await GitHubRepositoryProvider.create(installationId);

      // Detect empty repo — listDirectory returns [] on 404
      const rootEntries = await provider.listDirectory(owner, repo.name, "");
      const emptyRepo = rootEntries.length === 0;

      // Upsert Installation record — new repos get use_central_api: true
      await (prisma.installation as any).upsert({
        create: {
          id: repo.id,
          action_count: actionCount,
          installation_id: installationId,
          owner,
          repo: repo.name,
          use_central_api: true,
        },
        update: {
          owner,
          repo: repo.name,
        },
        where: { id: repo.id },
      });
      logwatch.info({ ...logCtx, message: "Installation record upserted" });

      // Save latest commit info if the repo is not empty
      if (emptyRepo) {
        logwatch.info({
          ...logCtx,
          message: "Empty repository detected - skipping commit save",
        });
      } else {
        try {
          const repoInfo = await provider.getRepoInfo(owner, repo.name);
          const commit = await provider.getLatestCommit(
            owner,
            repo.name,
            repoInfo.defaultBranch,
          );
          await saveLatestCommit(repo.id, commit);
          logwatch.info({ ...logCtx, message: "Latest commit saved" });
        } catch (err: any) {
          logwatch.warn({
            ...logCtx,
            error: err.message,
            message: "Could not save latest commit",
          });
        }
      }

      // Upsert Analytics record
      await prisma.analytics.upsert({
        create: { id: repo.id },
        update: {},
        where: { id: repo.id },
      });
      logwatch.info({ ...logCtx, message: "Analytics record upserted" });

      if (applyActionLimit) {
        logwatch.info({
          ...logCtx,
          message: "Action limit applied — skipping compliance run",
          repoNumber: repoCount,
        });
        continue;
      }

      // Run compliance and create dashboard issue
      const subjects = await runComplianceChecks(
        provider,
        owner,
        repo.name,
        repo.id,
        { fullCodefairRun: true },
      );
      await createOrUpdateDashboardIssue(
        provider,
        owner,
        repo.name,
        repo.id,
        subjects,
        emptyRepo,
      );
      logwatch.success({ ...logCtx, message: "Dashboard created" });
    } catch (err: any) {
      logwatch.error({ ...logCtx, error: err.message, message: "Failed" });
    }
  }
}

/**
 * Handles a `installation.deleted` or `installation_repositories.removed` webhook event.
 * Deletes the Installation record for each removed repository; cascade deletes in the
 * schema clean up all child records automatically.
 * @param payload - The raw GitHub webhook payload.
 */
export async function handleInstallationRemoved(payload: any) {
  const repositories: any[] =
    payload.repositories ?? payload.repositories_removed ?? [];
  const owner: string = payload.installation?.account?.login;
  const installationId: number = payload.installation?.id;

  for (const repo of repositories) {
    const logCtx = {
      action: "installation.removed",
      installationId,
      owner,
      repo: repo.name ?? repo.full_name,
    };

    try {
      await prisma.installation.delete({ where: { id: repo.id } });
      logwatch.success({ ...logCtx, message: "Installation deleted" });
    } catch (err: any) {
      // P2025 = record not found — safe to ignore
      if (err.code !== "P2025") {
        logwatch.error({
          ...logCtx,
          error: err.message,
          message: "Failed to delete installation",
        });
      }
    }
  }
}
