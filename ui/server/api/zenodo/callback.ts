/**
 * GET /api/zenodo/callback
 *
 * OAuth callback handler for Zenodo.
 * Exchanges the authorization code for an access + refresh token pair and
 * stores them in the database. Redirects back to the release page on success,
 * or to `/zenodo-auth-error` on failure.
 *
 * The `state` parameter is a JSON-encoded object:
 *   { userId, owner, repo, githubDetails: { githubTag, githubRelease } }
 *
 * This matches the encoding produced by the GET /api/[owner]/[repo]/release/zenodo
 * endpoint when it builds the Zenodo login URL.
 */
import { logwatch } from "~/server/utils/logwatch";

export default defineEventHandler(async (event) => {
  const ZENODO_ENDPOINT = process.env.ZENODO_ENDPOINT ?? "";
  const ZENODO_CLIENT_ID = process.env.ZENODO_CLIENT_ID ?? "";
  const ZENODO_CLIENT_SECRET = process.env.ZENODO_CLIENT_SECRET ?? "";
  const ZENODO_REDIRECT_URI = process.env.ZENODO_REDIRECT_URI ?? "";

  const query = getQuery(event);
  const { code, state } = query;

  if (!code || !state) {
    logwatch.warn({
      action: "zenodo_callback",
      message: "OAuth callback missing required query params",
      reason: "missing_params",
    });
    return sendRedirect(event, "/zenodo-auth-error?reason=missing_params");
  }

  // Parse state produced by ZenodoProvider.getLoginUrl as JSON
  let parsedState: {
    githubDetails: { githubRelease?: string; githubTag?: string };
    owner: string;
    repo: string;
    userId: string;
  };

  try {
    parsedState = JSON.parse(decodeURIComponent(state as string));
  } catch (err) {
    logwatch.error({
      action: "zenodo_callback",
      message: "Failed to parse OAuth state parameter",
      reason: "invalid_state",
      stack: err instanceof Error ? err.stack : undefined,
    });
    return sendRedirect(event, "/zenodo-auth-error?reason=invalid_state");
  }

  const { githubDetails, owner, repo, userId } = parsedState;

  if (!userId || !owner || !repo) {
    logwatch.warn({
      action: "zenodo_callback",
      message: "OAuth state is missing required fields",
      owner: owner ?? null,
      reason: "incomplete_state",
      repo: repo ?? null,
      userId: userId ?? null,
    });
    return sendRedirect(event, "/zenodo-auth-error?reason=incomplete_state");
  }

  logwatch.info({
    action: "zenodo_callback",
    message: "Zenodo OAuth callback received, exchanging code for tokens",
    owner,
    repo,
  });

  // Exchange authorization code for tokens
  const urlEncoded = new URLSearchParams({
    client_id: ZENODO_CLIENT_ID,
    client_secret: ZENODO_CLIENT_SECRET,
    code: code as string,
    grant_type: "authorization_code",
    redirect_uri: ZENODO_REDIRECT_URI,
    scope: "deposit:actions deposit:write",
  });

  let access_token: string;
  let refresh_token: string;

  try {
    const oauthTokenRes = await fetch(`${ZENODO_ENDPOINT}/oauth/token`, {
      body: urlEncoded,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });

    if (!oauthTokenRes.ok) {
      logwatch.error({
        action: "zenodo_callback",
        message: "Zenodo token exchange returned a non-OK response",
        owner,
        reason: "token_exchange_failed",
        repo,
        status: oauthTokenRes.status,
      });
      return sendRedirect(
        event,
        "/zenodo-auth-error?reason=token_exchange_failed",
      );
    }

    const tokens = await oauthTokenRes.json();

    if (
      typeof tokens.access_token !== "string" ||
      typeof tokens.refresh_token !== "string"
    ) {
      logwatch.error({
        action: "zenodo_callback",
        message: "Zenodo token response is missing expected token fields",
        owner,
        reason: "invalid_token_response",
        repo,
      });
      return sendRedirect(
        event,
        "/zenodo-auth-error?reason=invalid_token_response",
      );
    }

    access_token = tokens.access_token;
    refresh_token = tokens.refresh_token;
  } catch (err) {
    logwatch.error({
      action: "zenodo_callback",
      message: "Zenodo token exchange request threw an exception",
      owner,
      reason: "token_exchange_error",
      repo,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return sendRedirect(
      event,
      "/zenodo-auth-error?reason=token_exchange_error",
    );
  }

  // Persist token — upsert by user_id
  const tokenData = {
    expires_at: new Date(Date.now() + 3600 * 1000),
    refresh_token,
    token: access_token,
    user_id: userId,
  };

  const existingToken = await prisma.zenodoToken.findFirst({
    where: { user_id: userId },
  });

  if (existingToken) {
    await prisma.zenodoToken.update({
      data: tokenData,
      where: { id: existingToken.id },
    });
    logwatch.info({
      action: "zenodo_callback",
      message: "Updated existing Zenodo token for user",
      owner,
      repo,
    });
  } else {
    await prisma.zenodoToken.create({ data: tokenData });
    logwatch.info({
      action: "zenodo_callback",
      message: "Created new Zenodo token for user",
      owner,
      repo,
    });
  }

  // Redirect back to the release page, preserving the GitHub context
  const tag = githubDetails?.githubTag ?? "";
  const releaseId = githubDetails?.githubRelease ?? "";

  logwatch.success({
    action: "zenodo_callback",
    message: "Zenodo OAuth flow completed, redirecting to release page",
    owner,
    repo,
    tag,
  });

  return sendRedirect(
    event,
    `/dashboard/${owner}/${repo}/release/zenodo?githubTag=${tag}&githubRelease=${releaseId}`,
  );
});
