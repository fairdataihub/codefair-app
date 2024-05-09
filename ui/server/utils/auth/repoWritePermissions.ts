import type { User } from "lucia";

const repoWritePermissions = async (
  event: any,
  owner: string,
  repo: string,
) => {
  const user = event.context.user as User;

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request. Missing owner or repo in the URL params",
    });
  }

  // Check if the user has write/admin access to the repository
  const permissions = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/collaborators/${user.username}/permission`,
    {
      headers: {
        Authorization: `Bearer ${user.access_token}`,
      },
    },
  );

  if (!permissions.ok) {
    if (permissions.status === 404) {
      throw createError({
        statusCode: 404,
        statusMessage: "repo-not-found",
      });
    }

    if (permissions.status === 403) {
      throw createError({
        statusCode: 403,
        statusMessage: "forbidden-repo-access",
      });
    }

    throw createError({
      message: "Internal Server Error. Failed to fetch repository permissions",
      statusCode: 500,
    });
  }

  const permissionsJson = await permissions.json();

  if (
    permissionsJson.permission !== "admin" &&
    permissionsJson.permission !== "write"
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: "unauthorized-repo-access",
    });
  }
};

export default repoWritePermissions;
