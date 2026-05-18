/**
 * POST /api/zenodo/disconnect
 *
 * Removes the current user's stored Zenodo OAuth token from the database.
 * After calling this endpoint the user will need to re-authorise via Zenodo
 * before they can publish again.
 */
import type { User } from "lucia";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const user = event.context.user as User | null;
  const userId = user?.id;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  await prisma.zenodoToken.deleteMany({ where: { user_id: userId } });

  return { message: "Zenodo account disconnected" };
});
