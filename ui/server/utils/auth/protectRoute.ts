/**
 * Auth function to check if the user is permitted to access the requested resource
 * The logged in user needs to have write/admin access to the github repository
 * @param event - The event object
 * @param repoLevelProtection - If set to false, the util function will not check for repository level permissions
 */

import type { User, Session } from "lucia";

export default defineEventHandler((event) => {
  const user = event.context.user as User | null;
  const session = event.context.session as Session | null;

  if (!user || !session) {
    // Get the original path from the request
    const redirectPath = encodeURIComponent(event.node.req.url || "/");

    throw createError({
      statusCode: 401,
      statusMessage: "unauthorized",
      data: { redirect: `/login/github?redirect=${redirectPath}` },
    });
  }

  if (!user.access_token) {
    throw createError({
      statusCode: 401,
      statusMessage: "missing-access-token",
    });
  }
});
