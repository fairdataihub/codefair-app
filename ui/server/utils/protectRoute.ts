/**
 * Auth function to check if the user is permitted to access the requested resource
 * The logged in user needs to have write/admin access to the github repository
 * @param event - The event object
 * @param repoLevelProtection - If set to false, the util function will not check for repository level permissions
 */

import type { User, Session } from "lucia";

export default defineEventHandler(async (event, repoLevelProtection = true) => {
  const user = event.context.user as User | null;
  const session = event.context.session as Session | null;

  if (!user || !session) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  // If the repository level protection is not enabled, return early
  if (!repoLevelProtection) {
    return;
  }

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      message: "Bad Request. Missing owner or repo in the URL params",
    });
  }

  if (!user.access_token) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized. Missing access token",
    });
  }

  // Check if the user has write/admin access to the repository
  // await $fetch(
  //   `https://api.github.com/repos/${owner}/${repo}/collaborators/${user.username}/permission`,
  //   {
  //     headers: {
  //       Authorization: `Bearer ${user.access_token}`,
  //     },
  //   },
  // ).then((res) => {
  //   if (!res.ok) {
  //     throw createError({
  //       statusCode: 401,
  //       message:
  //         "Unauthorized. You do not have write access to this repository",
  //     });
  //   }
  // }).catch((err) => {
  //   throw createError({
  //     statusCode: 500,
  //     message: "Internal Server Error",
  //   });
  // });

  // Check if the user has write/admin access to the repository
  const permissions = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/collaborators/${user.username}/permission`,
    {
      headers: {
        Authorization: `Bearer ${user.access_token}`,
      },
    },
  );

  const permissionsJson = await permissions.json();

  if (
    permissionsJson.permission !== "admin" &&
    permissionsJson.permission !== "write"
  ) {
    throw createError({
      statusCode: 403,
      message: "Unauthorized. You do not have write access to this repository",
    });
  }

  return;
});
