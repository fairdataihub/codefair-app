/**
 * GET /api/zenodo/callback
 *
 * OAuth callback handler for Zenodo.
 * Exchanges the authorization code for an access + refresh token pair and
 * stores them in the database. Redirects back to the release page on success,
 * or to `/zenodo-auth-error` on failure.
 *
 * The `state` parameter is a JSON-encoded object built by POST /api/zenodo/login:
 *   { owner, repo, githubDetails: { githubTag, githubRelease }, issuedAt, sig }
 *
 * The state must be signed for the signed-in user and less than 30 minutes
 * old, and the token is stored for that user, so a crafted callback URL cannot
 * attach a Zenodo account to someone else's Codefair account. The same state
 * can be retried after Zenodo's intermittent failures until it expires.
 *
 * Once the state is parsed, error redirects carry the owner, repo and GitHub
 * details so the error page can send the user back to connect with a personal
 * access token instead.
 */
import type { User } from "lucia";
import { logwatch } from "~/server/utils/logwatch";
import { isUnderMaintenance } from "~/server/utils/maintenance";
import { encryptToken, zenodoTokenContext } from "~/server/utils/tokenCrypto";
import {
  checkZenodoOAuthState,
  type ZenodoOAuthState,
} from "~/server/utils/zenodoOAuthState";

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

  // Parse state produced by POST /api/zenodo/login as JSON
  let parsedState: ZenodoOAuthState;

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

  const { githubDetails, owner, repo } = parsedState;

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

  if (!owner || !repo) {
    logwatch.warn({
      action: "zenodo_callback",
      message: "OAuth state is missing required fields",
      owner: owner ?? null,
      reason: "incomplete_state",
      repo: repo ?? null,
    });
    return sendRedirect(event, "/zenodo-auth-error?reason=incomplete_state");
  }

  // The token is saved for whoever is signed in, never for an ID in the state
  const sessionUser = event.context.user as User | null;
  if (!sessionUser) {
    logwatch.warn({
      action: "zenodo_callback",
      message: "OAuth callback received without a signed-in Codefair user",
      owner,
      reason: "not_signed_in",
      repo,
    });
    return errorRedirect("not_signed_in");
  }
  const userId = sessionUser.id;

  // Only a sign-in this user started, in the last 30 minutes, can finish
  const stateCheck = checkZenodoOAuthState(parsedState, userId);
  if (stateCheck !== "valid") {
    const reason =
      stateCheck === "expired" ? "state_expired" : "state_mismatch";
    logwatch.warn({
      action: "zenodo_callback",
      message:
        stateCheck === "expired"
          ? "OAuth state is more than 30 minutes old"
          : "OAuth state was not signed for the signed-in user",
      owner,
      reason,
      repo,
    });
    return errorRedirect(reason);
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

  const releaseQuery = new URLSearchParams({
    githubRelease: releaseId,
    githubTag: tag,
  });

  return sendRedirect(
    event,
    `/dashboard/${owner}/${repo}/release/zenodo?${releaseQuery.toString()}`,
  );
});
