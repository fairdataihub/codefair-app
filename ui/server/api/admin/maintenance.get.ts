/**
 * GET /api/admin/maintenance
 *
 * Every maintenance switch with its current state, for the admin panel.
 */
import {
  MAINTENANCE_KEYS,
  resolveMaintenanceMessage,
} from "#shared/utils/maintenance";
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const rows = await prisma.maintenanceFlag.findMany({
    select: {
      enabled: true,
      enabled_at: true,
      key: true,
      message: true,
      updated_at: true,
      updated_by: { select: { id: true, username: true } },
    },
    where: { key: { in: [...MAINTENANCE_KEYS] } },
  });

  const byKey = new Map(rows.map((row) => [row.key, row]));

  // Return every key, even ones with no row yet, so the admin panel does not
  // have to fill in defaults itself. No row means the workflow is live.
  const data = MAINTENANCE_KEYS.map((key) => {
    const row = byKey.get(key);

    return {
      enabled: row?.enabled ?? false,
      enabledAt: row?.enabled_at ?? null,
      key,
      message: row?.message ?? "",
      previewMessage: resolveMaintenanceMessage(key, row?.message),
      updatedAt: row?.updated_at ?? null,
      updatedBy: row?.updated_by ?? null,
    };
  });

  return { data };
});
