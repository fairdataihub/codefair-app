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
  const responseOne = await fetch(`https://api.github.com/user/orgs`, {
    headers: {
      Authorization: `Bearer ${user.access_token}`,
    },
  });

  if (!responseOne.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: "Something went wrong",
    });
  }

  const organizationsOne = await responseOne.json();

  const responseTwo = await fetch(
    `https://api.github.com/users/${user.username}/orgs`,
    {
      headers: {
        Authorization: `Bearer ${user.access_token}`,
      },
    },
  );

  if (!responseTwo.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: "Something went wrong",
    });
  }

  const organizationsTwo = await responseTwo.json();

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

  return {
    orgs: uniqueOrgs,
    user: {
      id: user.id,
      username: user.username,
      github_id: user.github_id,
    },
  };
});
