import type { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";

export interface AdminAuditEntry {
  /** What was done, e.g. UPDATE_MAINTENANCE or GRANT_ADMIN. */
  action: string;
  /** Codefair user ID of the admin, or null for CLI scripts. */
  actorId: string | null;
  /** GitHub username of the admin, or "script:<name>" for CLI scripts. */
  actorLabel: string;
  details?: Prisma.InputJsonObject;
  entityId: string;
  entityType: string;
}

/**
 * Builds the audit log write for an admin action. It returns the Prisma
 * promise rather than awaiting it, so callers put it in the same
 * `$transaction` as the change it records: either both are saved or neither.
 * @param entry - What was done, by whom, to what.
 * @param client - Prisma client or transaction client to write with.
 * @returns The pending AdminAuditLog create.
 */
export function logAdminAction(
  entry: AdminAuditEntry,
  client: Pick<Prisma.TransactionClient, "adminAuditLog"> = prisma,
) {
  return client.adminAuditLog.create({
    data: {
      action: entry.action,
      actor_id: entry.actorId,
      actor_label: entry.actorLabel,
      details: entry.details,
      entity_id: entry.entityId,
      entity_type: entry.entityType,
    },
  });
}
