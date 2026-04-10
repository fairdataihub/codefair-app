import { createEventStream } from "h3";
import { GitHubRepositoryProvider } from "~/server/services/providers/github";
import { runComplianceChecks } from "~/server/services/compliance/index";
import { createOrUpdateDashboardIssue } from "~/server/services/dashboard/manager";
import { logwatch } from "~/server/utils/logwatch";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  const cwlValidationRequest = await prisma.cwlValidation.findFirst({
    include: {
      repository: true,
    },
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!cwlValidationRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "CWL validation request not found",
    });
  }

  if (!cwlValidationRequest.repository) {
    throw createError({
      statusCode: 404,
      statusMessage: "Installation not found",
    });
  }

  if (!cwlValidationRequest.repository.use_central_api) {
    logwatch.warn({
      action: "rerun-cwl",
      installationId: cwlValidationRequest.repository.installation_id,
      message: "Central API mode not enabled — CWL rerun rejected",
      owner,
      repo,
    });
    throw createError({
      statusCode: 400,
      statusMessage: "Central API mode required for rerun",
    });
  }

  await repoWritePermissions(event, owner, repo);

  const logCtx = {
    action: "rerun-cwl",
    installationId: cwlValidationRequest.repository.installation_id,
    owner,
    repo,
    timestamp: new Date().toISOString(),
    user: event.context.user?.username,
  };

  const eventStream = createEventStream(event);

  const push = (event: string, message: string) =>
    eventStream.push({ data: JSON.stringify({ message }), event });

  // Run CWL compliance checks in the background and stream progress to the client
  (async () => {
    try {
      logwatch.info({ ...logCtx, message: "CWL rerun started" });
      await push("running", "Connecting to repository...");

      const provider = await GitHubRepositoryProvider.create(
        cwlValidationRequest.repository.installation_id,
      );
      logwatch.info({
        ...logCtx,
        message: "Provider created, scanning for CWL files",
      });
      await push("progress", "Scanning for CWL files...");

      const subjects = await runComplianceChecks(
        provider,
        owner,
        repo,
        cwlValidationRequest.repository.id,
        { checks: ["cwl"] },
      );
      logwatch.info({
        ...logCtx,
        message: "CWL checks complete, updating dashboard",
      });
      await push("progress", "Saving results to database...");

      await createOrUpdateDashboardIssue(
        provider,
        owner,
        repo,
        cwlValidationRequest.repository.id,
        subjects,
        false,
        { checks: ["cwl"] },
      );

      await prisma.analytics.upsert({
        create: {
          id: cwlValidationRequest.repository.id,
          cwl_rerun_validation: 1,
        },
        update: { cwl_rerun_validation: { increment: 1 } },
        where: { id: cwlValidationRequest.repository.id },
      });
      await push("progress", "Updating GitHub issue...");

      logwatch.success({
        ...logCtx,
        message: "CWL rerun complete",
        result: "complete",
      });
      await push("complete", "CWL validation completed successfully.");
    } catch (error: any) {
      logwatch.error({
        ...logCtx,
        error: error?.message,
        message: "CWL rerun failed",
      });
      await push("fail", "CWL validation failed. Please try again.");
    } finally {
      await eventStream.close();
    }
  })();

  return eventStream.send();
});
