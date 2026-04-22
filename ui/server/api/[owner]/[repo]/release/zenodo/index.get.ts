/**
 * GET /api/[owner]/[repo]/release/zenodo
 *
 * Returns all data needed to render the Zenodo release page:
 *  - Whether the user has a valid Zenodo token (auto-refreshed if so)
 *  - Zenodo login URL (if not connected)
 *  - List of existing Zenodo depositions
 *  - GitHub releases and tags for the repository
 *  - Last release/deposition state from the database
 *  - License information
 *
 * The `githubTag` and `githubRelease` query params are forwarded into the
 * OAuth state so the callback can redirect back to the correct page.
 */
import type { User } from "lucia";
import {
  validateZenodoToken,
  ZenodoProvider,
} from "~/server/services/archival/zenodo";
import { logwatch } from "~/server/utils/logwatch";

interface ZenodoDeposition {
  id: number;
  title: string;
  conceptrecid: string;
  state: string;
  submitted: boolean;
}

interface GitHubRelease {
  id: number;
  name: string;
  assetsUrl: string;
  draft: boolean;
  htmlUrl: string;
  prerelease: boolean;
  tagName: string;
  targetCommitish: string;
  updatedAt: string;
}

interface ZenodoMetadata {
  accessRight: string | null;
  version: string;
}

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const user = event.context.user as User | null;

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  const query = getQuery(event);
  const githubTag = (query.githubTag as string) ?? "";
  const githubRelease = (query.githubRelease as string) ?? "";

  // Permission checks
  await repoWritePermissions(event, owner, repo);

  const isOrg = await ownerIsOrganization(event, owner);
  await isOrganizationMember(event, isOrg, owner);

  // GitHub repo info
  const repoResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: { Authorization: `token ${user?.access_token}` },
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

  // License + metadata prerequisite check
  const [licenseResponse, metadataResponse] = await Promise.all([
    prisma.licenseRequest.findFirst({ where: { repository_id: repoId } }),
    prisma.codeMetadata.findFirst({ where: { repository_id: repoId } }),
  ]);

  if (!licenseResponse || !metadataResponse) {
    throw createError({
      statusCode: 404,
      statusMessage: "license-metadata-not-found",
    });
  }

  // Zenodo token + depositions
  const userId = user?.id ?? "";

  const state = JSON.stringify({
    githubDetails: { githubRelease, githubTag },
    owner,
    repo,
    userId,
  });

  const zenodoProvider = new ZenodoProvider();
  const zenodoLoginUrl = zenodoProvider.getLoginUrl(state);

  let existingDepositions: any[] = [];
  let haveValidZenodoToken = false;
  try {
    const tokenResult = await validateZenodoToken(userId);
    existingDepositions = tokenResult.existingDepositions;
    haveValidZenodoToken = tokenResult.valid;
  } catch (err: any) {
    logwatch.warn({
      action: "zenodo.get.validateToken",
      message: `Token validation error: ${err.message}`,
      userId,
    });
    // Fall through with haveValidZenodoToken=false so the page still loads
    // and the user can reconnect their Zenodo account
  }

  // DB deposition record
  const zenodoDeposition = await prisma.zenodoDeposition.findFirst({
    include: { user: true },
    where: { repository: { owner, repo } },
  });

  const raw = zenodoDeposition?.zenodo_metadata as unknown as ZenodoMetadata;
  const zenodoMetadata: ZenodoMetadata = {
    accessRight: raw?.accessRight ?? null,
    version: raw?.version ?? "",
  };

  // GitHub releases + tags
  const githubAccessToken = user?.access_token;

  const [grRes, gtRes] = await Promise.all([
    fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${githubAccessToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    ),
    fetch(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=100`, {
      headers: {
        Authorization: `Bearer ${githubAccessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }),
  ]);

  if (!grRes.ok) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch GitHub releases",
    });
  }
  if (!gtRes.ok) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch GitHub tags",
    });
  }

  const githubReleasesJson = await grRes.json();
  const githubTagsJson = await gtRes.json();

  const githubReleases: GitHubRelease[] = [];
  const tagMap = new Map<string, any>();

  for (const r of githubReleasesJson) {
    githubReleases.push({
      id: r.id,
      name: r.name,
      assetsUrl: r.assets_url,
      draft: r.draft,
      htmlUrl: r.html_url,
      prerelease: r.prerelease,
      tagName: r.tag_name,
      targetCommitish: r.target_commitish,
      updatedAt: r.updated_at,
    });

    tagMap.set(r.tag_name, {
      name: r.tag_name,
      commit: { sha: r.target_commitish, url: "" },
      node_id: "",
      released: !r.draft,
      tarballUrl: "",
      zipballUrl: "",
    });
  }

  for (const t of githubTagsJson) {
    const existing = tagMap.get(t.name);
    if (existing) {
      tagMap.set(t.name, {
        ...existing,
        commit: { sha: t.commit.sha, url: t.commit.url },
        node_id: t.node_id,
        tarballUrl: t.tarball_url,
        zipballUrl: t.zipball_url,
      });
    } else {
      const matchingRelease = githubReleasesJson.find(
        (r: any) => r.tag_name === t.name,
      );
      tagMap.set(t.name, {
        name: t.name,
        commit: { sha: t.commit.sha, url: t.commit.url },
        node_id: t.node_id,
        released: Boolean(matchingRelease && !matchingRelease.draft),
        tarballUrl: t.tarball_url,
        zipballUrl: t.zipball_url,
      });
    }
  }

  // Sort releases newest-first
  githubReleases.sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return tb - ta;
  });

  // Sort tags: semver descending, then alphabetical
  const semverRegex = /^v?(\d+(?:\.\d+)*)(?:[-+].*)?$/i;
  const numericTags: { parts: number[]; tag: any }[] = [];
  const alphaTags: any[] = [];

  for (const tag of tagMap.values()) {
    const m = String(tag.name).match(semverRegex);
    if (m) {
      numericTags.push({ parts: m[1].split(".").map(Number), tag });
    } else {
      alphaTags.push(tag);
    }
  }

  numericTags.sort((a, b) => {
    const la = a.parts;
    const lb = b.parts;
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      const diff = (lb[i] ?? 0) - (la[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });
  alphaTags.sort((a, b) => a.name.localeCompare(b.name));

  const githubTagsSorted = numericTags.map((n) => n.tag).concat(alphaTags);

  // Response
  return {
    existingZenodoDepositionId:
      zenodoDeposition?.existing_zenodo_deposition_id ?? null,
    githubReleases,
    githubTags: githubTagsSorted,
    haveValidZenodoToken,
    lastPublishedZenodoDoi: zenodoDeposition?.last_published_zenodo_doi ?? "",
    lastSelectedGithubRelease: zenodoDeposition?.github_release_id ?? null,
    lastSelectedGithubReleaseTitle:
      githubReleases.find((r) => r.id === zenodoDeposition?.github_release_id)
        ?.name ?? "",
    lastSelectedGithubTag: zenodoDeposition?.github_tag_name ?? null,
    lastSelectedUser: zenodoDeposition?.user?.username ?? null,
    license: {
      id: licenseResponse.license_id ?? "",
      customLicenseTitle: licenseResponse.custom_license_title ?? "",
      status: licenseResponse.license_status ?? "",
    },
    zenodoDepositionId: zenodoDeposition?.zenodo_id ?? null,
    zenodoDepositions: existingDepositions,
    zenodoLoginUrl,
    zenodoMetadata,
    zenodoWorkflowStatus: zenodoDeposition?.status ?? "",
  };
});
