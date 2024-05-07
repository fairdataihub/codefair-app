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
      message: "Bad Request. Missing owner or repo in the URL params",
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

  console.log(
    "url: ",
    `https://api.github.com/repos/${owner}/${repo}/collaborators/${user.username}/permission`,
  );
  console.log("headers: ", {
    Authorization: `Bearer ${user.access_token}`,
  });

  if (!permissions.ok) {
    if (permissions.status === 404) {
      throw createError({
        statusCode: 404,
        message: "Not Found. Repository not found",
      });
    }

    if (permissions.status === 403) {
      throw createError({
        statusCode: 403,
        message: "Forbidden. You do not have access to this repository",
      });
    }

    throw createError({
      statusCode: 500,
      message: "Internal Server Error. Failed to fetch repository permissions",
    });
  }

  const permissionsJson = await permissions.json();

  console.log("permissionsJson: ", permissionsJson);

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
};

export default repoWritePermissions;
