/**
 * Lists, grants or revokes Codefair admin access from the command line. This
 * is how the first admin is made on each database, and how access is
 * recovered if every admin is lost. After that, admins manage each other from
 * the Admins tab at /admin. Every change is written to the audit log.
 *
 * The user must have signed in to Codefair at least once on that environment.
 *
 * Usage (from ui/):
 *   DATABASE_URL=... yarn admin:role --list
 *   DATABASE_URL=... yarn admin:role --grant <github-username>
 *   DATABASE_URL=... yarn admin:role --revoke <github-username>
 */
/* eslint-disable no-console -- This maintenance script reports its progress to the operator. */
import { Prisma, PrismaClient } from "@prisma/client";

const USAGE =
  "Usage: yarn admin:role --list\n" +
  "       yarn admin:role --grant <github-username>\n" +
  "       yarn admin:role --revoke <github-username>";

/**
 * @param url - A postgres connection string.
 * @returns host:port/database, without credentials.
 */
function describeTarget(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "(DATABASE_URL could not be parsed)";
  }
}

async function main() {
  const [command, username, ...rest] = process.argv.slice(2);

  const needsUsername = command === "--grant" || command === "--revoke";

  if (
    !command ||
    !["--grant", "--list", "--revoke"].includes(command) ||
    (needsUsername && !username) ||
    (!needsUsername && username) ||
    rest.length > 0
  ) {
    console.error(USAGE);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  console.log(`Target database: ${describeTarget(databaseUrl)}`);

  const prisma = new PrismaClient();

  try {
    if (command === "--list") {
      const admins = await prisma.user.findMany({
        orderBy: { username: "asc" },
        select: { username: true, github_id: true, last_login: true },
        where: { role: "admin" },
      });

      if (admins.length === 0) {
        console.log("No admins yet.");
      }

      for (const admin of admins) {
        console.log(
          `${admin.username} (GitHub ID ${admin.github_id}, last signed in ${admin.last_login.toISOString()})`,
        );
      }
      return;
    }

    const role = command === "--grant" ? "admin" : "user";

    const result = await prisma.$transaction(
      async (tx) => {
        const matches = await tx.user.findMany({
          select: { id: true, username: true, github_id: true, role: true },
          where: { username: { equals: username, mode: "insensitive" } },
        });

        if (matches.length === 0) {
          throw new Error(
            `No Codefair user named "${username}". They need to sign in to Codefair once first.`,
          );
        }

        if (matches.length > 1) {
          throw new Error(
            `More than one user is named "${username}" (GitHub IDs ${matches.map((m) => m.github_id).join(", ")}). Change the role in the database directly.`,
          );
        }

        const target = matches[0]!;

        if (target.role === role) {
          return { username: target.username, changed: false };
        }

        if (role !== "admin") {
          const adminCount = await tx.user.count({ where: { role: "admin" } });

          if (adminCount <= 1) {
            throw new Error(
              "Codefair needs at least one admin. Grant someone else admin first.",
            );
          }
        }

        await tx.user.update({
          data: { role },
          where: { id: target.id },
        });

        await tx.adminAuditLog.create({
          data: {
            action: role === "admin" ? "GRANT_ADMIN" : "REVOKE_ADMIN",
            actor_id: null,
            actor_label: "script:admin-role",
            details: {
              username: target.username,
              github_id: target.github_id,
              previousRole: target.role,
            },
            entity_id: target.id,
            entity_type: "user",
          },
        });

        return { username: target.username, changed: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.changed) {
      console.log(
        `${result.username} ${role === "admin" ? "is already an admin" : "is not an admin"}. Nothing changed.`,
      );
      return;
    }

    console.log(
      role === "admin"
        ? `${result.username} is now an admin.`
        : `${result.username} is no longer an admin.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    "Admin role change failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
