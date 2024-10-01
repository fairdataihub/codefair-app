import type { User } from "lucia";

export default defineEventHandler(async (event) => {
  const ZENODO_ENDPOINT = process.env.ZENODO_ENDPOINT || "";
  const ZENODO_API_ENDPOINT = process.env.ZENODO_API_ENDPOINT || "";
  const ZENODO_CLIENT_ID = process.env.ZENODO_CLIENT_ID || "";
  const ZENODO_REDIRECT_URI = process.env.ZENODO_REDIRECT_URI || "";

  protectRoute(event);

  const user = event.context.user as User | null;

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  // Check if the user has write permissions to the repository
  await repoWritePermissions(event, owner, repo);

  const isOrg = await ownerIsOrganization(event, owner);
  await isOrganizationMember(event, isOrg, owner);

  const userId = user?.id;
  const githubAccessToken = user?.access_token;
  const state = `${userId}:${owner}:${repo}`;

  const zenodoLoginUrl = `${ZENODO_ENDPOINT}/oauth/authorize?response_type=code&client_id=${ZENODO_CLIENT_ID}&scope=${encodeURIComponent("deposit:write deposit:actions")}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(ZENODO_REDIRECT_URI)}`;

  let haveValidZenodoToken = false;

  const zenodoTokenInfo = await prisma.zenodoToken.findFirst({
    where: {
      user_id: userId,
    },
  });

  const existingDepositions: ZenodoDeposition[] = [];
  const rawData = [];

  if (!zenodoTokenInfo) {
    haveValidZenodoToken = false;
  } else if (zenodoTokenInfo && zenodoTokenInfo.expires_at < new Date()) {
    haveValidZenodoToken = false;
  } else {
    // Check if the token is valid
    const zenodoTokenInfoResponse = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions?access_token=${zenodoTokenInfo.token}`,
      {
        method: "GET",
      },
    );

    if (!zenodoTokenInfoResponse.ok) {
      haveValidZenodoToken = false;
    } else {
      haveValidZenodoToken = true;

      const response = await zenodoTokenInfoResponse.json();

      for (const item of response) {
        existingDepositions.push({
          id: item.id,
          title: item.title,
          conceptrecid: item.conceptrecid,
          state: item.state,
          submitted: item.submitted,
        });
        rawData.push(item);
      }
    }
  }

  const zenodoDeposition = await prisma.zenodoDeposition.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  const raw = zenodoDeposition?.zenodo_metadata as unknown as ZenodoMetadata;

  const zenodoMetadata: ZenodoMetadata = {
    accessRight: raw?.accessRight || null,
  };

  // Get a list of github releases
  const gr = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases`,
    {
      headers: {
        Authorization: `Bearer ${githubAccessToken}`,
      },
      method: "GET",
    },
  );

  if (!gr.ok) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch GitHub releases",
    });
  }

  const githubReleases: GitHubReleases = [];

  const githubReleasesJson = await gr.json();

  for (const release of githubReleasesJson) {
    githubReleases.push({
      id: release.id,
      name: release.name,
      tagName: release.tag_name,
      targetCommitish: release.target_commitish,
      assetsUrl: release.assets_url,
      htmlUrl: release.html_url,
      draft: release.draft,
      prerelease: release.prerelease,
    });
  }

  return {
    existingZenodoDepositionId:
      zenodoDeposition?.existing_zenodo_deposition_id || null,
    haveValidZenodoToken,
    zenodoDepositionId: zenodoDeposition?.zenodo_id || null,
    token: zenodoTokenInfo?.token || "",
    zenodoDepositions: existingDepositions,
    zenodoLoginUrl: zenodoLoginUrl || "",
    zenodoMetadata,
    rawReleases: githubReleasesJson,
    githubReleases,
    // rawZenodoDepositions: rawData,
  };
});
