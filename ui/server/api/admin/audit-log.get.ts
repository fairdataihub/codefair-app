/**
 * GET /api/admin/audit-log
 *
 * Paginated admin audit log, newest first.
 * Query: page (default 1), limit (default 25, max 100), action (exact match).
 */
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const query = getQuery(event);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const action = typeof query.action === "string" ? query.action.trim() : "";

  const where = action ? { action } : {};

  const [rows, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        action: true,
        actor: { select: { id: true, username: true, github_id: true } },
        actor_label: true,
        created_at: true,
        details: true,
        entity_id: true,
        entity_type: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      where,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  const data = rows.map((row) => ({
    id: row.id,
    action: row.action,
    actor: row.actor,
    actorLabel: row.actor_label,
    createdAt: row.created_at,
    details: row.details,
    entityId: row.entity_id,
    entityType: row.entity_type,
  }));

  return { data, limit, page, total };
});
