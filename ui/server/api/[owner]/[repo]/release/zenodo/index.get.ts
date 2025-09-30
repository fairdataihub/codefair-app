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
    version: raw?.version || "",
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

  // Get a list of github tags
  const gt = await fetch(`https://api.github.com/repos/${owner}/${repo}/tags`, {
    headers: {
      Authorization: `Bearer ${githubAccessToken}`,
    },
    method: "GET",
  });

  if (!gt.ok) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch GitHub tags",
    });
  }

  // const githubTags: GitHubTags = [];

  const githubReleases: GitHubReleases = [];

  const githubReleasesJson = await gr.json();
  const githubTagsJson = await gt.json();
  // Create a map for tags keyed by their name
  const tagMap = new Map();

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
      updatedAt: release.updated_at,
    });

    // Add draft tag to the tag map
    tagMap.set(release.tag_name, {
      name: release.tag_name,
      commit: { sha: release.target_commitish, url: "" },
      node_id: "",
      released: !release.draft,
      tarballUrl: "",
      zipballUrl: "",
    });
  }

  // Process GitHub tags JSON, updating or adding each tag
  // console.log("githubTagsJson", githubTagsJson);
  for (const tag of githubTagsJson) {
    const existingTag = tagMap.get(tag.name);

    if (existingTag) {
      // Only update unreleased tags, leave released ones untouched
      // console.log("existingTag name", existingTag.name);
      tagMap.set(tag.name, {
        name: tag.name,
        commit: { sha: tag.commit.sha, url: tag.commit.url },
        node_id: tag.node_id,
        released: existingTag.released,
        tarballUrl: tag.tarball_url,
        zipballUrl: tag.zipball_url,
      });
    } else {
      // Add new tag with proper release status
      const matchingRelease = githubReleasesJson.find(
        (release: any) => release.tag_name === tag.name,
      );

      // A tag is "released" only if there's a matching non-draft release
      const released = Boolean(matchingRelease && !matchingRelease.draft);

      tagMap.set(tag.name, {
        name: tag.name,
        commit: { sha: tag.commit.sha, url: tag.commit.url },
        node_id: tag.node_id,
        released,
        tarballUrl: tag.tarball_url,
        zipballUrl: tag.zipball_url,
      });
    }
  }

  // sort releases by updatedAt (newest first)
  githubReleases.sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return tb - ta;
  });

  // Convert the map back to an array
  const githubTags = Array.from(tagMap.values());

  // sort tags: numeric (semantic versions) first (greatest -> least)
  const semverRegex = /^v?(\d+(?:\.\d+)*)(?:[-+].*)?$/i;

  const numericTags: { parts: number[]; tag: any }[] = [];
  const alphaTags: any[] = [];

  for (const tag of githubTags) {
    const m = String(tag.name).match(semverRegex);
    if (m) {
      const parts = m[1].split(".").map((p) => parseInt(p, 10) || 0);
      numericTags.push({ parts, tag });
    } else {
      alphaTags.push(tag);
    }
  }

  numericTags.sort((a, b) => {
    const la = a.parts;
    const lb = b.parts;
    const max = Math.max(la.length, lb.length);
    for (let i = 0; i < max; i++) {
      const va = la[i] ?? 0;
      const vb = lb[i] ?? 0;
      if (va !== vb) {
        return vb - va;
      } // descending
    }
    return 0;
  });

  // then alphabetically A-Z
  alphaTags.sort((a, b) => a.name.localeCompare(b.name));

  const githubTagsSorted = numericTags.map((n) => n.tag).concat(alphaTags);

  return {
    existingZenodoDepositionId:
      zenodoDeposition?.existing_zenodo_deposition_id || null,
    githubReleases,
    githubTags: githubTagsSorted,
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
      customLicenseTitle: licenseResponse.custom_license_title || "",
      status: licenseResponse.license_status || "",
    },
    zenodoDepositionId: zenodoDeposition?.zenodo_id || null,
    zenodoDepositions: existingDepositions,
    zenodoLoginUrl: zenodoLoginUrl || "",
    zenodoMetadata,
    zenodoWorkflowStatus: zenodoDeposition?.status || "",
  };
});
