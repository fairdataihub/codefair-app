import { createHmac, timingSafeEqual } from "crypto";
import { logwatch } from "~/server/utils/logwatch";
import { handlePush } from "~/server/services/webhooks/push";
import { handlePullRequest } from "~/server/services/webhooks/pull-request";
import {
  handleIssueClosed,
  handleIssueReopened,
} from "~/server/services/webhooks/issues";
import {
  handleInstallationAdded,
  handleInstallationRemoved,
} from "~/server/services/webhooks/installation";

/**
 * Verify the GitHub webhook HMAC-SHA256 signature.
 * Must be called with the raw (unparsed) request body.
 */
function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    logwatch.warn(
      "[webhook] WEBHOOK_SECRET is not set — skipping verification",
    );
    return true;
  }
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function routeWebhookEvent(event: string, payload: any) {
  switch (event) {
    case "push":
      await handlePush(payload);
      break;
    case "pull_request":
      if (payload.action === "opened" || payload.action === "closed") {
        await handlePullRequest(payload);
      }
      break;
    case "issues":
      if (payload.action === "reopened") {
        await handleIssueReopened(payload);
      } else if (payload.action === "closed") {
        await handleIssueClosed(payload);
      } else if (payload.action === "edited") {
        logwatch.info(
          `[webhook] Ignoring edited issue event for ${payload.repository.full_name}#${payload.issue.number}`,
        );
      }
      break;
    case "installation":
      if (payload.action === "created") {
        await handleInstallationAdded(payload);
      } else if (payload.action === "deleted") {
        await handleInstallationRemoved(payload);
      }
      break;
    case "installation_repositories":
      if (payload.action === "added") {
        await handleInstallationAdded(payload);
      } else if (payload.action === "removed") {
        await handleInstallationRemoved(payload);
      }
      break;
    default:
      logwatch.info(`[webhook] Unhandled event: ${event}`);
  }
}

export default defineEventHandler(async (event) => {
  // Read the raw body BEFORE H3 parses it — required for HMAC verification
  const rawBody = await readRawBody(event);
  if (!rawBody) {
    throw createError({ statusCode: 400, statusMessage: "Empty request body" });
  }

  const signature = getHeader(event, "x-hub-signature-256") ?? null;

  if (!verifySignature(rawBody, signature)) {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid webhook signature",
    });
  }

  const ghEvent = getHeader(event, "x-github-event");
  if (!ghEvent) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing x-github-event header",
    });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid JSON body" });
  }

  // Process async — GitHub expects a fast 200 response
  await routeWebhookEvent(ghEvent, payload);

  return { ok: true };
});
