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

  // Make GitHub API call to get the user's repo ID number
  const repoResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: {
        Authorization: `token ${user?.access_token}`,
      },
    },
  );

  if (!repoResponse.ok) {
    throw createError({
      statusCode: 404,
      statusMessage: "repository-not-found",
    });
  }

  const repoData = await repoResponse.json();
  const repoId = repoData.id;

  // Call both the license and metadata tables to get their identifiers
  const licenseResponse = await prisma.licenseRequest.findFirst({
    where: {
      repository_id: repoId,
    },
  });

  const metadataResponse = await prisma.codeMetadata.findFirst({
    where: {
      repository_id: repoId,
    },
  });

  if (!licenseResponse || !metadataResponse) {
    throw createError({
      statusCode: 404,
      statusMessage: "license-metadata-not-found",
    });
  }

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
    include: {
      user: true,
    },
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
      assetsUrl: release.assets_url,
      draft: release.draft,
      htmlUrl: release.html_url,
      prerelease: release.prerelease,
      tagName: release.tag_name,
      targetCommitish: release.target_commitish,
    });
  }

  return {
    existingZenodoDepositionId:
      zenodoDeposition?.existing_zenodo_deposition_id || null,
    githubReleases,
    haveValidZenodoToken,
    lastPublishedZenodoDoi: zenodoDeposition?.last_published_zenodo_doi || "",
    lastSelectedGithubRelease: zenodoDeposition?.github_release_id || null,
    lastSelectedGithubReleaseTitle:
      githubReleases.find(
        (release: any) => release.id === zenodoDeposition?.github_release_id,
      )?.name || "",
    lastSelectedGithubTag: zenodoDeposition?.github_tag_name || null,
    lastSelectedUser: zenodoDeposition?.user.username || null,
    license: {
      id: licenseResponse.license_id || "",
      identifier: licenseResponse.identifier || "",
    },
    metadataId: metadataResponse.identifier,
    token: zenodoTokenInfo?.token || "",
    zenodoDepositionId: zenodoDeposition?.zenodo_id || null,
    zenodoDepositions: existingDepositions,
    zenodoLoginUrl: zenodoLoginUrl || "",
    zenodoMetadata,
    zenodoWorkflowStatus: zenodoDeposition?.status || "",
  };
});
