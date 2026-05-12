import type { User } from "lucia";
import {
  validateZenodoToken,
  ZenodoProvider,
} from "~/server/services/archival/zenodo";
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const user = event.context.user as User | null;

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  await repoWritePermissions(event, owner, repo);

  const installation = await prisma.installation.findFirst({
    include: {
      LicenseRequest: true,
      ZenodoDeposition: true,
    },
    where: { owner, repo },
  });

  if (!installation) {
    throw createError({
      statusCode: 404,
      statusMessage: "installation-not-found",
    });
  }

  const lrRaw = installation.LicenseRequest;
  const zenRaw = installation.ZenodoDeposition;

  // Validate Zenodo token and retrieve existing depositions
  const { existingDepositions, valid: haveValidZenodoToken } =
    await validateZenodoToken(user?.id ?? "");

  // Build Zenodo OAuth login URL
  const zenodoProvider = new ZenodoProvider();
  const state = JSON.stringify({
    owner,
    repo,
    userId: user?.id ?? "",
  });
  const zenodoLoginUrl = zenodoProvider.getLoginUrl(state);

  // Fetch GitHub releases
  const ghHeaders = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${user?.access_token ?? ""}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const [releasesRes, tagsRes] = await Promise.all([
    fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`,
      {
        headers: ghHeaders,
      },
    ),
    fetch(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=100`, {
      headers: ghHeaders,
    }),
  ]);

  const githubReleases: Array<{
    id: number;
    name: string;
    draft: boolean;
    prerelease: boolean;
    tag_name: string;
  }> = releasesRes.ok ? await releasesRes.json() : [];

  const rawTags: Array<{ name: string }> = tagsRes.ok
    ? await tagsRes.json()
    : [];

  // Mark tags that are already used by a published release
  const publishedTagNames = new Set(
    githubReleases.filter((r) => !r.draft).map((r) => r.tag_name),
  );

  const githubTags = rawTags.map((t) => ({
    name: t.name,
    released: publishedTagNames.has(t.name),
  }));

  // Resolve last-selected release title from already-fetched releases
  const lastSelectedGithubReleaseTitle =
    zenRaw?.github_release_id != null
      ? (githubReleases.find((r) => r.id === zenRaw.github_release_id)?.name ??
        null)
      : null;

  // Resolve last-selected username
  let lastSelectedUser: string | null = null;
  if (zenRaw?.user_id) {
    const dbUser = await prisma.user.findFirst({
      select: { username: true },
      where: { id: zenRaw.user_id },
    });
    lastSelectedUser = dbUser?.username ?? null;
  }

  return {
    githubReleases: githubReleases.map((r) => ({
      id: r.id,
      name: r.name,
      draft: r.draft,
      prerelease: r.prerelease,
    })),
    githubTags,
    haveValidZenodoToken,
    lastPublishedZenodoDoi: zenRaw?.last_published_zenodo_doi ?? null,
    lastSelectedGithubRelease: zenRaw?.github_release_id ?? null,
    lastSelectedGithubReleaseTitle,
    lastSelectedGithubTag: zenRaw?.github_tag_name ?? null,
    lastSelectedUser,
    license: {
      id: lrRaw?.license_id ?? "",
      customLicenseTitle: "",
      status: lrRaw?.license_status ?? "",
    },
    zenodoDepositions: existingDepositions,
    zenodoEndpoint: process.env.ZENODO_ENDPOINT ?? "",
    zenodoLoginUrl,
    zenodoMetadata: zenRaw?.zenodo_metadata ?? {},
    zenodoWorkflowStatus: zenRaw?.status ?? "",
  };
});
