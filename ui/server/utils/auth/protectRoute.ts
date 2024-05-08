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
    throw createError({
      message: "Unauthorized",
      statusCode: 401,
    });
  }

  if (!user.access_token) {
    throw createError({
      data: {
        code: "missing-access-token",
        message: "Unauthorized. Missing access token",
      },
      statusCode: 401,
    });
  }
});
