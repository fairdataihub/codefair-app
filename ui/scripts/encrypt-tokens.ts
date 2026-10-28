/**
 * Encrypts every stored GitHub and Zenodo token that is still plain text, so
 * existing rows match the encryption the app now applies to every new token.
 * With --decrypt it does the reverse, which is the rollback path before
 * redeploying a version of Codefair that predates encryption.
 *
 * Run it once per database, AFTER the version of Codefair that reads
 * encrypted tokens is live there. An older version would send the encrypted
 * value to GitHub or Zenodo as the token and fail.
 *
 * Usage (from ui/):
 *   DATABASE_URL=... TOKEN_ENCRYPTION_KEY=... yarn tokens:encrypt            # dry run
 *   DATABASE_URL=... TOKEN_ENCRYPTION_KEY=... yarn tokens:encrypt --apply    # encrypt
 *   DATABASE_URL=... TOKEN_ENCRYPTION_KEY=... yarn tokens:encrypt --decrypt --apply
 *
 * TOKEN_ENCRYPTION_KEY must be the key the app uses on that environment.
 * The script refuses to run when an already encrypted value does not decrypt
 * with it. Tokens are never printed.
 */
/* eslint-disable no-console -- This maintenance script reports its progress to the operator. */
import { PrismaClient } from "@prisma/client";
import {
  decryptToken,
  encryptToken,
  githubTokenContext,
  isEncryptedToken,
  parseTokenEncryptionKey,
  zenodoTokenContext,
} from "../server/utils/tokenCrypto";

const USAGE =
  "Usage: yarn tokens:encrypt [--apply] [--decrypt]\n" +
  "  (no flags)  dry run, reports what would change\n" +
  "  --apply     write the changes\n" +
  "  --decrypt   decrypt instead of encrypt (rollback)";

const KNOWN_FLAGS = new Set(["--apply", "--decrypt", "--help"]);

type Mode = "encrypt" | "decrypt";

interface Counts {
  alreadyDone: number;
  changed: number;
  scanned: number;
  skipped: number;
  toChange: number;
}

const newCounts = (): Counts => ({
  alreadyDone: 0,
  changed: 0,
  scanned: 0,
  skipped: 0,
  toChange: 0,
});

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

/**
 * Works out the value to store for one column in the chosen mode.
 * @returns The new value, or null when the column is already in the target state.
 */
function transform(
  mode: Mode,
  value: string,
  context: string,
  key: Buffer,
): string | null {
  if (mode === "encrypt") {
    if (isEncryptedToken(value)) return null;

    const encrypted = encryptToken(value, context, key);

    // Never write a value that does not read back as the original
    if (decryptToken(encrypted, context, key) !== value) {
      throw new Error("Encrypted value did not decrypt back to the original");
    }

    return encrypted;
  }

  if (!isEncryptedToken(value)) return null;

  const decrypted = decryptToken(value, context, key);

  if (decrypted === null) {
    throw new Error("Encrypted value could not be decrypted with this key");
  }

  return decrypted;
}

async function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => !KNOWN_FLAGS.has(arg));

  if (args.includes("--help") || unknown.length > 0) {
    if (unknown.length > 0) console.error(`Unknown option: ${unknown[0]}`);
    console.error(USAGE);
    process.exit(unknown.length > 0 ? 1 : 0);
  }

  const apply = args.includes("--apply");
  const mode: Mode = args.includes("--decrypt") ? "decrypt" : "encrypt";

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const key = parseTokenEncryptionKey(process.env.TOKEN_ENCRYPTION_KEY);
  if (!key) {
    console.error(
      "TOKEN_ENCRYPTION_KEY is missing or is not 32 random bytes encoded as base64.",
    );
    process.exit(1);
  }

  console.log(`Target database: ${describeTarget(databaseUrl)}`);
  console.log(
    `Mode: ${mode}${apply ? "" : " (dry run, nothing will be written)"}`,
  );

  const prisma = new PrismaClient();

  try {
    // The columns and audit table come from the migration that ships with
    // encryption, so their absence means the app was not deployed here yet
    try {
      await prisma.zenodoToken.findFirst({ select: { token_type: true } });
      await prisma.adminAuditLog.count();
    } catch {
      console.error(
        "This database is missing the encryption migration. Deploy the new version of Codefair (which runs the migrations) before running this script.",
      );
      process.exit(1);
    }

    const users = await prisma.user.findMany({
      select: { id: true, access_token: true, github_id: true },
      where: { access_token: { not: "" } },
    });

    const zenodoTokens = await prisma.zenodoToken.findMany({
      select: { refresh_token: true, token: true, user_id: true },
    });

    // Preflight: every value that is already encrypted must decrypt with this
    // key, otherwise this is the wrong key for this database
    let foreign = 0;
    for (const row of users) {
      if (
        isEncryptedToken(row.access_token) &&
        decryptToken(
          row.access_token,
          githubTokenContext(row.github_id),
          key,
        ) === null
      ) {
        foreign++;
      }
    }
    for (const row of zenodoTokens) {
      const columns: Array<["token" | "refresh_token", string | null]> = [
        ["token", row.token],
        ["refresh_token", row.refresh_token],
      ];
      for (const [field, value] of columns) {
        if (
          value &&
          isEncryptedToken(value) &&
          decryptToken(value, zenodoTokenContext(row.user_id, field), key) ===
            null
        ) {
          foreign++;
        }
      }
    }

    if (foreign > 0) {
      console.error(
        `${foreign} stored value(s) are already encrypted with a different key. Check that TOKEN_ENCRYPTION_KEY is the key this environment uses. Nothing was changed.`,
      );
      process.exit(1);
    }

    const github = newCounts();
    const zenodoAccess = newCounts();
    const zenodoRefresh = newCounts();

    // GitHub access tokens
    for (const row of users) {
      github.scanned++;

      const next = transform(
        mode,
        row.access_token,
        githubTokenContext(row.github_id),
        key,
      );

      if (next === null) {
        github.alreadyDone++;
        continue;
      }

      github.toChange++;

      if (!apply) continue;

      // Only rewrite the row if it still holds the value read above, so a
      // token saved by a sign-in in the meantime is never overwritten
      const { count } = await prisma.user.updateMany({
        data: { access_token: next },
        where: { id: row.id, access_token: row.access_token },
      });

      if (count === 1) github.changed++;
      else github.skipped++;
    }

    // Zenodo access and refresh tokens
    for (const row of zenodoTokens) {
      zenodoAccess.scanned++;

      const nextToken = transform(
        mode,
        row.token,
        zenodoTokenContext(row.user_id, "token"),
        key,
      );

      let nextRefresh: string | null = null;
      if (row.refresh_token) {
        zenodoRefresh.scanned++;
        nextRefresh = transform(
          mode,
          row.refresh_token,
          zenodoTokenContext(row.user_id, "refresh_token"),
          key,
        );
      }

      if (nextToken === null) zenodoAccess.alreadyDone++;
      else zenodoAccess.toChange++;

      if (row.refresh_token) {
        if (nextRefresh === null) zenodoRefresh.alreadyDone++;
        else zenodoRefresh.toChange++;
      }

      if (nextToken === null && nextRefresh === null) continue;
      if (!apply) continue;

      // Same guard as above: a token refreshed in the meantime is left alone
      const { count } = await prisma.zenodoToken.updateMany({
        data: {
          refresh_token: nextRefresh ?? row.refresh_token,
          token: nextToken ?? row.token,
        },
        where: {
          refresh_token: row.refresh_token,
          token: row.token,
          user_id: row.user_id,
        },
      });

      if (count === 1) {
        if (nextToken !== null) zenodoAccess.changed++;
        if (nextRefresh !== null) zenodoRefresh.changed++;
      } else {
        if (nextToken !== null) zenodoAccess.skipped++;
        if (nextRefresh !== null) zenodoRefresh.skipped++;
      }
    }

    const done = mode === "encrypt" ? "already encrypted" : "already plain";
    const report = (label: string, counts: Counts) =>
      console.log(
        `${label}: ${counts.scanned} scanned, ${counts.alreadyDone} ${done}, ` +
          (apply
            ? `${counts.changed} changed, ${counts.skipped} skipped (changed while running)`
            : `${counts.toChange} would change`),
      );

    report("GitHub access tokens", github);
    report("Zenodo access tokens", zenodoAccess);
    report("Zenodo refresh tokens", zenodoRefresh);

    if (!apply) {
      console.log("Dry run: nothing was written. Re-run with --apply.");
      return;
    }

    const changed =
      github.changed + zenodoAccess.changed + zenodoRefresh.changed;
    const skipped =
      github.skipped + zenodoAccess.skipped + zenodoRefresh.skipped;

    if (changed === 0 && skipped === 0) {
      console.log("Done. Nothing needed changing.");
      return;
    }

    await prisma.adminAuditLog.create({
      data: {
        action: mode === "encrypt" ? "ENCRYPT_TOKENS" : "DECRYPT_TOKENS",
        actor_id: null,
        actor_label: "script:encrypt-tokens",
        details: {
          githubTokens: github.changed,
          skipped,
          zenodoRefreshTokens: zenodoRefresh.changed,
          zenodoTokens: zenodoAccess.changed,
        },
        entity_id: "all",
        entity_type: "tokens",
      },
    });

    console.log(
      skipped > 0
        ? `Done. ${skipped} value(s) changed while the script ran and were left alone; run it again to pick them up.`
        : "Done.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    "Token encryption failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
