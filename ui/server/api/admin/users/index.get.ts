/**
 * GET /api/admin/users?search=<username>
 *
 * Finds Codefair users by GitHub username for the Add admin picker. Only
 * people who have signed in to Codefair at least once have a user row, so
 * only they can be made admins.
 */
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const query = getQuery(event);
  const search =
    typeof query.search === "string" ? query.search.trim().slice(0, 39) : "";

  if (!search) {
    return { data: [] };
  }

  const users = await prisma.user.findMany({
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      github_id: true,
      last_login: true,
      role: true,
    },
    take: 10,
    where: { username: { contains: search, mode: "insensitive" } },
  });

  return { data: users };
});
