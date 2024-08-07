import { generateState } from "arctic";

export default defineEventHandler(async (event) => {
  // Get the current domain from the request
  const headers = getHeaders(event);
  const hostHeader = headers.host;

  const domain = hostHeader?.includes("localhost")
    ? "http://localhost:3000"
    : `https://${hostHeader}`;

  const query = getQuery(event);

  const state = generateState();
  const url = await github.createAuthorizationURL(state, {
    scopes: ["repo", "read:user", "user:email", "read:org"],
  });

  const formattedURL = query.redirect
    ? `${url.toString()}&redirect_uri=${domain}/login/github/callback?redirect=${decodeURIComponent(query.redirect.toString() || "")}`
    : url.toString();

  setCookie(event, "github_oauth_state", state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return sendRedirect(event, formattedURL);
});
