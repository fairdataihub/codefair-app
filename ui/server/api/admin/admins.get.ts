/**
 * GET /api/admin/admins
 *
 * Every Codefair user with admin access.
 */
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const admins = await prisma.user.findMany({
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      github_id: true,
      last_login: true,
    },
    where: { role: "admin" },
  });

  return { data: admins };
});
