import { createEventStream } from "h3";
import { z } from "zod";
import { GitHubRepositoryProvider } from "~/server/services/providers/github";
import { runComplianceChecks } from "~/server/services/compliance/index";
import type { RunComplianceOptions } from "~/server/services/compliance/index";
import { createOrUpdateDashboardIssue } from "~/server/services/dashboard/manager";
import { logwatch } from "~/server/utils/logwatch";

const RERUN_OPTIONS: Record<string, RunComplianceOptions> = {
  "code-of-conduct": { checks: ["cofc"] },
  "code-of-conduct-validation": { checks: ["cofc"] },
  contributing: { checks: ["contributing"] },
  "contributing-validation": { checks: ["contributing"] },
  "full-repo": { fullCodefairRun: true },
  "full-repo-validation": { fullCodefairRun: true },
  license: { checks: ["license"] },
  "license-validation": { checks: ["license"] },
  metadata: { checks: ["metadata"] },
  "metadata-validation": { checks: ["metadata"] },
  readme: { checks: ["readme"] },
  "readme-validation": { checks: ["readme"] },
};

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const querySchema = z.object({ rerunType: z.string() });
  const parsed = querySchema.safeParse(getQuery(event));

  if (!parsed.success || !RERUN_OPTIONS[parsed.data.rerunType]) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid or missing rerunType",
    });
  }

  const { rerunType } = parsed.data;

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  const installation = await prisma.installation.findFirst({
    where: { owner, repo },
  });

  if (!installation) {
    throw createError({
      statusCode: 404,
      statusMessage: "Installation not found",
    });
  }

  if (!installation.use_central_api) {
    throw createError({
      statusCode: 400,
      statusMessage: "Central API mode required for rerun",
    });
  }

  await repoWritePermissions(event, owner, repo);

  const logCtx = {
    action: "rerun",
    installationId: installation.installation_id,
    owner,
    repo,
    rerunType,
    timestamp: new Date().toISOString(),
    user: event.context.user?.username,
  };

  const eventStream = createEventStream(event);

  const push = (event: string, message: string) =>
    eventStream.push({ data: JSON.stringify({ message }), event });

  // Run compliance checks in the background and stream progress to the client
  (async () => {
    try {
      logwatch.info(logCtx, true);
      await push("running", "Connecting to repository...");

      const provider = await GitHubRepositoryProvider.create(
        installation.installation_id,
      );
      await push("progress", "Running compliance checks...");

      const subjects = await runComplianceChecks(
        provider,
        owner,
        repo,
        installation.id,
        RERUN_OPTIONS[rerunType],
      );
      await push("progress", "Saving results to database...");

      await createOrUpdateDashboardIssue(
        provider,
        owner,
        repo,
        installation.id,
        subjects,
        false,
        RERUN_OPTIONS[rerunType],
      );
      await push("progress", "Updating GitHub issue...");

      logwatch.success({ ...logCtx, result: "complete" }, true);
      await push("complete", "All checks completed successfully.");
    } catch (error: any) {
      logwatch.error({ ...logCtx, error: error?.message }, true);
      await push("fail", "Checks failed. Please try again.");
    } finally {
      await eventStream.close();
    }
  })();

  return eventStream.send();
});
