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

  let ownerIsOrganization = false;

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
    ownerIsOrganization = ownerProfileJson.type === "Organization";

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

  // For the first 10 repositories, get the latest commit details
  for (let index = 0; index < Math.min(installations.length, 10); index++) {
    const installation = installations[index];

    const repo = installation.repo as string;

    const commits = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
      {
        headers: {
          Authorization: `Bearer ${user.access_token}`,
        },
      },
    );

    let latestCommitSha = "";
    let latestCommitMessage = "";
    let latestCommitUrl = "";
    let latestCommitDate = "";

    if (commits.ok) {
      const commitsJson = await commits.json();

      if (commitsJson.length > 0) {
        latestCommitSha = commitsJson[0].sha || "";
        latestCommitMessage = commitsJson[0].commit.message || "";
        latestCommitUrl = commitsJson[0].html_url || "";
        latestCommitDate = commitsJson[0].commit.author.date || "";
      }
    } else {
      console.error(
        `Failed to fetch commits for the repository ${repo} for the owner ${owner}`,
      );

      console.error(await commits.text());
    }

    installations[index] = {
      ...installation,
      latestCommitDate,
      latestCommitMessage,
      latestCommitSha,
      latestCommitUrl,
    };
  }

  return installations.map((installation) => ({
    installationId: installation.installationId as number,
    latestCommitDate: installation.latestCommitDate as string,
    latestCommitMessage: installation.latestCommitMessage as string,
    latestCommitSha: installation.latestCommitSha as string,
    latestCommitUrl: installation.latestCommitUrl as string,
    ownerIsOrganization,
    repo: installation.repo as string,
    repositoryId: installation.repositoryId as number,
  }));
});
