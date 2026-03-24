import { GitHubRepositoryProvider } from "~/server/services/providers/github";
import { runComplianceChecks } from "~/server/services/compliance/index";
import { createOrUpdateDashboardIssue } from "~/server/services/dashboard/manager";
import prisma from "~/server/utils/prisma";

export async function handleInstallationAdded(payload: any) {
  const repositories: any[] =
    payload.repositories ?? payload.repositories_added ?? [];
  const owner: string = payload.installation.account.login;
  const installationId: number = payload.installation.id;

  let repoCount = 0;

  for (const repo of repositories) {
    repoCount++;
    const applyActionLimit = repoCount > 5;
    const actionCount = applyActionLimit ? 5 : 0;

    try {
      const provider = await GitHubRepositoryProvider.create(installationId);

      // Detect empty repo — listDirectory returns [] on 404
      const rootEntries = await provider.listDirectory(owner, repo.name, "");
      const emptyRepo = rootEntries.length === 0;

      // Gather latest commit SHA if repo is not empty
      let latestCommitSha = "";
      const latestCommitDate = "";
      const latestCommitMessage = "";
      const latestCommitUrl = "";

      if (!emptyRepo) {
        try {
          const repoInfo = await provider.getRepoInfo(owner, repo.name);
          const sha = await provider.getBranchSha(
            owner,
            repo.name,
            repoInfo.defaultBranch,
          );
          latestCommitSha = sha;
        } catch {
          // Non-fatal — leave defaults as ""
        }
      }

      // Upsert Installation record — new repos get use_central_api: true
      await (prisma.installation as any).upsert({
        create: {
          id: repo.id,
          action_count: actionCount,
          installation_id: installationId,
          latest_commit_date: latestCommitDate,
          latest_commit_message: latestCommitMessage,
          latest_commit_sha: latestCommitSha,
          latest_commit_url: latestCommitUrl,
          owner,
          repo: repo.name,
          use_central_api: true,
        },
        update: {
          latest_commit_date: latestCommitDate,
          latest_commit_message: latestCommitMessage,
          latest_commit_sha: latestCommitSha,
          latest_commit_url: latestCommitUrl,
          owner,
          repo: repo.name,
        },
        where: { id: repo.id },
      });

      // Upsert Analytics record
      await prisma.analytics.upsert({
        create: { id: repo.id },
        update: {},
        where: { id: repo.id },
      });

      if (applyActionLimit) {
        console.log(
          `[webhook/installation.added] Action limit applied to ${owner}/${repo.name} (repo #${repoCount})`,
        );
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
      console.log(
        `[webhook/installation.added] Dashboard created for ${owner}/${repo.name}`,
      );
    } catch (err: any) {
      console.error(
        `[webhook/installation.added] Failed for ${owner}/${repo.name}:`,
        err.message,
      );
    }
  }
}

export async function handleInstallationRemoved(payload: any) {
  const repositories: any[] =
    payload.repositories ?? payload.repositories_removed ?? [];

  for (const repo of repositories) {
    try {
      // Cascade deletes in schema handle all child records
      await prisma.installation.delete({ where: { id: repo.id } });
      console.log(`[webhook/installation.removed] Deleted ${repo.full_name}`);
    } catch (err: any) {
      // P2025 = record not found — safe to ignore
      if (err.code !== "P2025") {
        console.error(
          `[webhook/installation.removed] Failed for ${repo.full_name}:`,
          err.message,
        );
      }
    }
  }
}
