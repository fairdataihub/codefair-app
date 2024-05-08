import type { User } from "lucia";

const repoWritePermissions = async (
  event: any,
  owner: string,
  repo: string,
) => {
  const user = event.context.user as User;

  if (!owner || !repo) {
    throw createError({
      message: "Bad Request. Missing owner or repo in the URL params",
      statusCode: 400,
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
        data: {
          code: "repo-not-found",
          message: "Not Found. Repository not found",
        },
        statusCode: 404,
      });
    }

    if (permissions.status === 403) {
      throw createError({
        data: {
          code: "forbidden-repo-access",
          message: "Forbidden. You do not have access to this repository",
        },
        statusCode: 403,
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
      data: {
        code: "unauthorized-repo-access",
        message:
          "Unauthorized. You do not have write access to this repository",
      },
      statusCode: 403,
    });
  }
};

export default repoWritePermissions;
