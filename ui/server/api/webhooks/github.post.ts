import { createHmac, timingSafeEqual } from "crypto";
import { App } from "octokit";

const GH_APP_NAME = process.env.GH_APP_NAME!;

/**
 * Verify the GitHub webhook HMAC-SHA256 signature.
 * Must be called with the raw (unparsed) request body.
 */
function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[webhook] WEBHOOK_SECRET is not set — skipping verification");
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

/**
 * Build an installation-scoped Octokit client.
 */
function getInstallationOctokit(installationId: number) {
  if (!process.env.GH_APP_PRIVATE_KEY) {
    throw new Error("GH_APP_PRIVATE_KEY is not set");
  }
  const app = new App({
    appId: process.env.GH_APP_ID!,
    oauth: {
      clientId: null as unknown as string,
      clientSecret: null as unknown as string,
    },
    privateKey: process.env.GH_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  });
  return app.getInstallationOctokit(installationId);
}

async function handlePush(payload: any) {
  const owner: string = payload.repository.owner.login;
  const repoName: string = payload.repository.name;
  const defaultBranch: string = payload.repository.default_branch;

  // Only act on pushes to the default branch
  if (payload.ref !== `refs/heads/${defaultBranch}`) {
    console.log(
      `[webhook/push] Ignoring push to non-default branch: ${payload.ref}`,
    );
    return;
  }

  console.log(`[webhook/push] Processing push to ${owner}/${repoName}`);

  // Look up the installation record
  const installation = await prisma.installation.findUnique({
    where: { id: payload.repository.id },
  });

  if (!installation || installation.disabled) {
    console.log(
      `[webhook/push] No active installation for ${owner}/${repoName}`,
    );
    return;
  }

  if (!payload.installation?.id) {
    console.error("[webhook/push] Missing installation.id in payload");
    return;
  }

  // Get an Octokit client authenticated as the GitHub App installation
  const octokit = await getInstallationOctokit(payload.installation.id);

  // ------------------------------------------------------------------
  // PoC compliance check: README detection (simplest possible check)
  // ------------------------------------------------------------------
  const readmePaths = [
    "README.md",
    "README.txt",
    "README",
    "docs/README.md",
    "docs/README.txt",
    "docs/README",
    ".github/README.md",
    ".github/README.txt",
    ".github/README",
  ];

  let readmeResult: { path: string; status: boolean } = {
    path: "No README file found",
    status: false,
  };

  for (const filePath of readmePaths) {
    try {
      await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner,
        path: filePath,
        repo: repoName,
      });
      readmeResult = { path: filePath, status: true };
      break;
    } catch (err: any) {
      if (err.status !== 404) {
        console.warn(
          `[webhook/push] Unexpected error checking ${filePath}:`,
          err.message,
        );
      }
    }
  }

  console.log(
    `[webhook/push] README check for ${owner}/${repoName}:`,
    readmeResult,
  );

  if (!installation.issue_number) {
    console.log(
      `[webhook/push] No dashboard issue for ${owner}/${repoName} — skipping comment`,
    );
    return;
  }

  const statusEmoji = readmeResult.status ? "✅" : "❌";
  const commentBody =
    `**[PoC] Nuxt webhook handler — push event processed**\n\n` +
    `- Repository: \`${owner}/${repoName}\`\n` +
    `- Commit: \`${payload.head_commit?.id?.slice(0, 7) ?? "unknown"}\`\n` +
    `- README check: ${statusEmoji} ${readmeResult.status ? `found at \`${readmeResult.path}\`` : "not found"}\n\n` +
    `_This comment was posted by the Nuxt server (not Probot) to confirm webhook auth + Octokit auth both work._`;

  try {
    await octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        body: commentBody,
        issue_number: installation.issue_number,
        owner,
        repo: repoName,
      },
    );
    console.log(
      `[webhook/push] Posted PoC comment on issue #${installation.issue_number}`,
    );
  } catch (err: any) {
    console.error("[webhook/push] Failed to post comment:", err.message);
  }
}

async function routeWebhookEvent(event: string, payload: any) {
  switch (event) {
    case "push":
      await handlePush(payload);
      break;
    default:
      console.log(`[webhook] Unhandled event: ${event}`);
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
