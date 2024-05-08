import type { User } from "lucia";

export default defineEventHandler(async (event) => {
  const user = event.context.user as User | null;

  return user
    ? {
        username: user?.username,
        githubId: user?.github_id,
        id: user?.id,
      }
    : null;
});
