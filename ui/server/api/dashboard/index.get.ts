import type { User } from "lucia";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const user = event.context.user as User | null;

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  // Get all the organizations the user is a member of
  const orgFetch = await fetch(`https://api.github.com/user/orgs`, {
    headers: {
      Authorization: `Bearer ${user.access_token}`,
    },
  });

  if (!orgFetch.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: "Something went wrong",
    });
  }

  const organizationsOne = await orgFetch.json();

  const orgDetails = await fetch(
    `https://api.github.com/users/${user.username}/orgs`,
    {
      headers: {
        Authorization: `Bearer ${user.access_token}`,
      },
    },
  );

  if (!orgDetails.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: "Something went wrong",
    });
  }

  const organizationsTwo = await orgDetails.json();

  const combinedOrgs = [
    ...organizationsOne.map((org: any) => {
      return {
        id: org.id,
        name: org.login,
        avatar: org.avatar_url,
        description: org.description,
      };
    }),
    ...organizationsTwo.map((org: any) => {
      return {
        id: org.id,
        name: org.login,
        avatar: org.avatar_url,
        description: org.description,
      };
    }),
  ];

  const uniqueOrgs = combinedOrgs.filter(
    (org, index, self) => index === self.findIndex((t) => t.id === org.id),
  );

  // Count the amount of repositories each organization has from the installation table
  const RepoCount = await prisma.installation.groupBy({
    by: ["owner"],
    _count: {
      repo: true,
    },
  });

  // Store each count in the org object
  uniqueOrgs.forEach((org) => {
    const repoCount = RepoCount.find((o) => o.owner === org.name);

    if (repoCount) {
      org.repoCount = repoCount._count.repo;
    } else {
      org.repoCount = 0;
    }
  });

  // Determine the amount of repos from user.username
  const userRepoCount = RepoCount.find((o) => o.owner === user.username);

  return {
    orgs: uniqueOrgs,
    user: {
      id: user.id,
      username: user.username,
      github_id: user.github_id,
      repoCount: userRepoCount ? userRepoCount._count.repo : 0,
    },
  };
});
