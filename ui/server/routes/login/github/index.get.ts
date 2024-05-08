import { generateState } from "arctic";

export default defineEventHandler(async (event) => {
  const state = generateState();
  const url = await github.createAuthorizationURL(state, {
    scopes: ["repo", "read:user", "user:email"],
  });

  setCookie(event, "github_oauth_state", state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return sendRedirect(event, url.toString());
});
