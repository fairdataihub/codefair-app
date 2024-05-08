import type { User } from "lucia";

export default defineEventHandler(async (event) => {
  const user = event.context.user as User | null;

  return user
    ? {
        id: user?.id,
        username: user?.username,
        github_id: user?.github_id,
      }
    : null;
});
