/**
 * PUT /api/admin/maintenance
 *
 * Saves one or more maintenance switches. The admin panel saves every pending
 * switch at once, so a single request can carry several workflows. Each
 * change is written to the audit log in the same transaction.
 */
import { z } from "zod";
import type { User } from "lucia";
import {
  MAINTENANCE_KEYS,
  resolveMaintenanceMessage,
} from "#shared/utils/maintenance";
import { logAdminAction } from "~/server/utils/logAdminAction";
import { logwatch } from "~/server/utils/logwatch";
import { invalidateMaintenanceCache } from "~/server/utils/maintenance";
import prisma from "~/server/utils/prisma";

const flagSchema = z
  .object({
    enabled: z.boolean(),
    key: z.enum(MAINTENANCE_KEYS),
    message: z.string().trim().max(500).default(""),
  })
  .strict();

const bodySchema = z
  .object({
    flags: z
      .array(flagSchema)
      .min(1)
      .max(MAINTENANCE_KEYS.length)
      .refine(
        (flags) => new Set(flags.map((flag) => flag.key)).size === flags.length,
        { message: "Each maintenance key may only appear once" },
      ),
  })
  .strict();

export default defineEventHandler(async (event) => {
  const admin: User = requireAdmin(event);

  const rawBody = await readBody(event);
  if (!rawBody) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing request body",
    });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request parameters",
    });
  }

  const { flags } = parsed.data;

  const existing = await prisma.maintenanceFlag.findMany({
    select: { enabled: true, enabled_at: true, key: true, message: true },
    where: { key: { in: flags.map((flag) => flag.key) } },
  });

  const existingByKey = new Map(existing.map((row) => [row.key, row]));

  // Only record what actually moved
  const changed = flags.filter((flag) => {
    const before = existingByKey.get(flag.key);

    return (
      (before?.enabled ?? false) !== flag.enabled ||
      (before?.message ?? "") !== flag.message
    );
  });

  if (changed.length === 0) {
    return { changed: [] };
  }

  await prisma.$transaction([
    ...changed.map((flag) => {
      const before = existingByKey.get(flag.key);

      // Keep the original start time across message edits so "paused since"
      // stays accurate, and clear it once the workflow is live again.
      const enabledAt = flag.enabled
        ? before?.enabled
          ? before.enabled_at
          : new Date()
        : null;

      return prisma.maintenanceFlag.upsert({
        create: {
          enabled: flag.enabled,
          enabled_at: enabledAt,
          key: flag.key,
          message: flag.message,
          updated_by_id: admin.id,
        },
        update: {
          enabled: flag.enabled,
          enabled_at: enabledAt,
          message: flag.message,
          updated_by_id: admin.id,
        },
        where: { key: flag.key },
      });
    }),
    ...changed.map((flag) =>
      logAdminAction({
        action: "UPDATE_MAINTENANCE",
        actorId: admin.id,
        actorLabel: admin.username,
        details: {
          enabled: flag.enabled,
          message: flag.message,
          previousEnabled: existingByKey.get(flag.key)?.enabled ?? false,
        },
        entityId: flag.key,
        entityType: "maintenance",
      }),
    ),
  ]);

  invalidateMaintenanceCache();

  logwatch.info({
    action: "admin.maintenance.update",
    admin: admin.username,
    changed: changed.map((flag) => ({
      enabled: flag.enabled,
      key: flag.key,
      message: resolveMaintenanceMessage(flag.key, flag.message),
    })),
    message: `Maintenance switches updated by ${admin.username}`,
  });

  return { changed: changed.map((flag) => flag.key) };
});
