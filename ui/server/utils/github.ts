import type { CommitDetails } from "~/server/services/providers/interface";
import prisma from "~/server/utils/prisma";
import { logwatch } from "~/server/utils/logwatch";

/**
 * Updates the latest commit fields on an Installation record.
 * @param repoId - The installation/repository ID (primary key).
 * @param commit - The commit info to save.
 * @param ctx - Optional log context (owner, repo, installationId) for structured logging.
 */
export async function saveLatestCommit(
  repoId: number,
  commit: CommitDetails,
  ctx?: { installationId?: number; owner?: string; repo?: string },
): Promise<void> {
  await prisma.installation.update({
    data: {
      latest_commit_date: commit.date,
      latest_commit_message: commit.message,
      latest_commit_sha: commit.sha,
      latest_commit_url: commit.url,
    },
    where: { id: repoId },
  });
  logwatch.info({
    action: "commit.save",
    ...ctx,
    message: "Latest commit saved",
  });
}
