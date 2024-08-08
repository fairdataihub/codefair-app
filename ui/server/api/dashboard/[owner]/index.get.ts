import type { User } from "lucia";
import { MongoClient } from "mongodb";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { GITHUB_OAUTH_APP_ID } = useRuntimeConfig(event);

  const { owner } = event.context.params as {
    owner: string;
  };

  if (!owner) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request. Missing owner in the URL params",
    });
  }

  const user = event.context.user as User;

  if (user.username !== owner) {
    // Get the owner profile
    const ownerProfile = await fetch(`https://api.github.com/users/${owner}`, {
      headers: {
        Authorization: `Bearer ${user.access_token}`,
      },
    });

    if (!ownerProfile.ok) {
      throw createError({
        statusCode: 500,
        statusMessage: "failed-to-fetch-owner",
      });
    }

    const ownerProfileJson = await ownerProfile.json();

    // Check if the owner is an organization
    const ownerIsOrganization = ownerProfileJson.type === "Organization";

    if (ownerIsOrganization) {
      // Check organization membership for a user
      // https://docs.github.com/en/rest/orgs/members?apiVersion=2022-11-28#check-organization-membership-for-a-user

      const isOrgMember = await fetch(
        `https://api.github.com/orgs/${owner}/members/${user.username}`,
        {
          headers: {
            Authorization: `Bearer ${user.access_token}`,
          },
        },
      );

      if (!isOrgMember.ok) {
        const statusMessage = `unauthorized-org-access|https://github.com/orgs/${owner}/policies/applications/${GITHUB_OAUTH_APP_ID}`;

        throw createError({
          statusCode: 403,
          statusMessage,
        });
      }
    } else {
      throw createError({
        statusCode: 403,
        statusMessage: "unauthorized-account-access",
      });
    }
  }

  const client = new MongoClient(process.env.MONGODB_URI as string, {});

  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME);
  const installationCollection = db.collection("installation");

  // Get all installations for the owner
  const installations = await installationCollection
    .find({
      owner,
    })
    .toArray();

  return installations.map((installation) => ({
    repo: installation.repo as string,
    repositoryId: installation.repositoryId as number,
  }));
});
