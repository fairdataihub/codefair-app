/**
 * PATCH /api/admin/users/[id]/role
 *
 * Grants or revokes admin access. Body: { role: "admin" | "user" }.
 *
 * Guards against locking everyone out: an admin cannot remove their own
 * access, and the last admin cannot be removed. The checks, the change and
 * the audit entry run in one serializable transaction, so two admins removing
 * each other at the same moment cannot both succeed.
 */
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { User } from "lucia";
import { logAdminAction } from "~/server/utils/logAdminAction";
import { logwatch } from "~/server/utils/logwatch";
import prisma from "~/server/utils/prisma";

const bodySchema = z
  .object({
    role: z.enum(["admin", "user"]),
  })
  .strict();

export default defineEventHandler(async (event) => {
  const admin: User = requireAdmin(event);

  const { id: targetId } = event.context.params as { id: string };

  if (!targetId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing user id",
    });
  }

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

  const { role } = parsed.data;

  if (targetId === admin.id && role !== "admin") {
    throw createError({
      statusCode: 400,
      statusMessage: "You can't remove your own admin access",
    });
  }

  let result: { username: string; changed: boolean };

  try {
    result = await prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({
          select: { id: true, username: true, github_id: true, role: true },
          where: { id: targetId },
        });

        if (!target) {
          throw createError({
            statusCode: 404,
            statusMessage: "User not found",
          });
        }

        if (target.role === role) {
          return { username: target.username, changed: false };
        }

        if (role !== "admin") {
          const adminCount = await tx.user.count({ where: { role: "admin" } });

          if (adminCount <= 1) {
            throw createError({
              statusCode: 409,
              statusMessage: "Codefair needs at least one admin",
            });
          }
        }

        await tx.user.update({
          data: { role },
          where: { id: target.id },
        });

        await logAdminAction(
          {
            action: role === "admin" ? "GRANT_ADMIN" : "REVOKE_ADMIN",
            actorId: admin.id,
            actorLabel: admin.username,
            details: {
              username: target.username,
              github_id: target.github_id,
              previousRole: target.role,
            },
            entityId: target.id,
            entityType: "user",
          },
          tx,
        );

        return { username: target.username, changed: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    // Another admin change ran at the same time
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      throw createError({
        statusCode: 409,
        statusMessage:
          "Another admin change happened at the same time. Please try again.",
      });
    }

    throw error;
  }

  if (result.changed) {
    logwatch.info({
      action: "admin.role.update",
      admin: admin.username,
      message: `${admin.username} ${role === "admin" ? "granted admin to" : "revoked admin from"} ${result.username}`,
      role,
      target: result.username,
    });
  }

  return { changed: result.changed, role };
});
