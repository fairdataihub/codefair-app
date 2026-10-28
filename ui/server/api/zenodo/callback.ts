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
 *
 * Once the state is parsed, error redirects carry the owner, repo and GitHub
 * details so the error page can send the user back to connect with a personal
 * access token instead.
 */
import { logwatch } from "~/server/utils/logwatch";
import { isUnderMaintenance } from "~/server/utils/maintenance";
import { encryptToken, zenodoTokenContext } from "~/server/utils/tokenCrypto";

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

  // Lets the error page link back to the release page
  const errorRedirect = (reason: string) => {
    const params = new URLSearchParams({ reason });
    if (owner && repo) {
      params.set("owner", owner);
      params.set("repo", repo);
      params.set("githubTag", githubDetails?.githubTag ?? "");
      params.set("githubRelease", githubDetails?.githubRelease ?? "");
    }
    return sendRedirect(event, `/zenodo-auth-error?${params.toString()}`);
  };

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

  // An admin paused OAuth sign-in from /admin
  if (await isUnderMaintenance("zenodoOAuth")) {
    logwatch.warn({
      action: "zenodo_callback",
      message: "OAuth callback received while Zenodo OAuth sign-in is paused",
      owner,
      reason: "oauth_paused",
      repo,
    });
    return errorRedirect("oauth_paused");
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

  let accessToken: string;
  let refreshToken: string;

  try {
    const oauthTokenRes = await fetch(`${ZENODO_ENDPOINT}/oauth/token`, {
      body: urlEncoded,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });

    if (!oauthTokenRes.ok) {
      logwatch.error({
        action: "zenodo_callback",
        body: await oauthTokenRes.text(),
        message: "Zenodo token exchange returned a non-OK response",
        owner,
        reason: "token_exchange_failed",
        repo,
        status: oauthTokenRes.status,
      });
      return errorRedirect("token_exchange_failed");
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
      return errorRedirect("invalid_token_response");
    }

    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
  } catch (err) {
    logwatch.error({
      action: "zenodo_callback",
      message: "Zenodo token exchange request threw an exception",
      owner,
      reason: "token_exchange_error",
      repo,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return errorRedirect("token_exchange_error");
  }

  // Persist token, encrypted. Replaces any earlier connection, OAuth or personal.
  const tokenData = {
    expires_at: new Date(Date.now() + 3600 * 1000),
    refresh_token: encryptToken(
      refreshToken,
      zenodoTokenContext(userId, "refresh_token"),
    ),
    token: encryptToken(accessToken, zenodoTokenContext(userId, "token")),
    token_type: "oauth",
  };

  await prisma.zenodoToken.upsert({
    create: { ...tokenData, user_id: userId },
    update: tokenData,
    where: { user_id: userId },
  });

  logwatch.info({
    action: "zenodo_callback",
    message: "Stored Zenodo OAuth token for user",
    owner,
    repo,
  });

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
