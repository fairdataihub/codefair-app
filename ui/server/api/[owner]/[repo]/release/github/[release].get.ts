import type { User } from "lucia";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, release, repo } = event.context.params as {
    owner: string;
    release: string;
    repo: string;
  };

  const user = event.context.user as User | null;

  // Check if the github release exists and is a draft
  const githubRelease = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/${release}`,
    {
      headers: {
        Authorization: `Bearer ${user?.access_token}`,
      },
      method: "GET",
    },
  );

  if (!githubRelease.ok) {
    throw createError({
      statusCode: 500,
      statusMessage: "GitHub release not found",
    });
  }

  const githubReleaseJson = await githubRelease.json();

  if (!githubReleaseJson.draft) {
    return {
      draft: false,
    };
  } else {
    return {
      draft: true,
    };
  }
});
