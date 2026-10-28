/**
 * Encryption at rest for stored OAuth and personal access tokens.
 *
 * GitHub and Zenodo tokens can act on a user's accounts, so they are encrypted
 * with AES-256-GCM before they reach the database. Each value is bound to its
 * row and column through additional authenticated data, so a value copied to
 * another row or column fails to decrypt instead of handing one user's token
 * to another.
 *
 * Stored format: enc:v1:<iv>:<auth tag>:<ciphertext>, each part base64url.
 * The version leaves room to rotate the key later. GitHub and Zenodo tokens
 * never contain colons, so the prefix never collides with a row written in
 * plain text before encryption was added.
 *
 * This file only depends on node:crypto so scripts/encrypt-tokens.ts can
 * import it outside of Nuxt.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const TOKEN_ENCRYPTION_PREFIX = "enc:v1:";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

/**
 * Additional authenticated data for a Zenodo token column.
 * @param userId - Codefair user ID that owns the token row.
 * @param field - Column the value is stored in.
 * @returns The context string to pass to encryptToken/decryptToken.
 */
export function zenodoTokenContext(
  userId: string,
  field: "token" | "refresh_token",
): string {
  return `zenodo-token:${field}:${userId}`;
}

/**
 * Additional authenticated data for a GitHub access token. Keyed by the
 * GitHub user ID because Lucia's getUserAttributes does not receive the row ID.
 * @param githubId - GitHub user ID stored on the User row.
 * @returns The context string to pass to encryptToken/decryptToken.
 */
export function githubTokenContext(githubId: number): string {
  return `github-token:access_token:${githubId}`;
}

/**
 * Decodes a base64 encryption key.
 * @param encoded - 32 random bytes as base64.
 * @returns The key, or null when it is missing or not 32 bytes long.
 */
export function parseTokenEncryptionKey(
  encoded: string | undefined,
): Buffer | null {
  if (!encoded) return null;

  const key = Buffer.from(encoded, "base64");

  return key.length === KEY_BYTES ? key : null;
}

// TOKEN_ENCRYPTION_KEY holds 32 random bytes as base64. Generate one with:
// node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
function requireKey(key?: Buffer): Buffer {
  const resolved =
    key ?? parseTokenEncryptionKey(process.env.TOKEN_ENCRYPTION_KEY);

  if (!resolved) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is missing or is not 32 bytes of base64",
    );
  }

  return resolved;
}

/**
 * @returns True when TOKEN_ENCRYPTION_KEY holds a usable key.
 */
export function isTokenEncryptionConfigured(): boolean {
  return parseTokenEncryptionKey(process.env.TOKEN_ENCRYPTION_KEY) !== null;
}

/**
 * @param stored - Value read from the database.
 * @returns True when the value was written by encryptToken.
 */
export function isEncryptedToken(stored: string): boolean {
  return stored.startsWith(TOKEN_ENCRYPTION_PREFIX);
}

/**
 * Encrypts a token for storage.
 * @param token - Plain text token.
 * @param context - Row and column binding from zenodoTokenContext/githubTokenContext.
 * @param key - Optional key override, used by scripts. Defaults to TOKEN_ENCRYPTION_KEY.
 * @returns The encrypted value in the enc:v1 format.
 */
export function encryptToken(
  token: string,
  context: string,
  key?: Buffer,
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, requireKey(key), iv, {
    authTagLength: AUTH_TAG_BYTES,
  });

  cipher.setAAD(Buffer.from(context, "utf8"));

  const cipherText = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  return `${TOKEN_ENCRYPTION_PREFIX}${[iv, cipher.getAuthTag(), cipherText]
    .map((part) => part.toString("base64url"))
    .join(":")}`;
}

/**
 * Returns a stored token in plain text. Rows from before encryption come back
 * as they are. Null means the value was altered, bound to another row, or
 * written with a different key; callers treat that as no connection so the
 * user connects again and the row is overwritten.
 * @param stored - Value read from the database.
 * @param context - Row and column binding the value was encrypted with.
 * @param key - Optional key override, used by scripts. Defaults to TOKEN_ENCRYPTION_KEY.
 * @returns The plain text token, or null when it cannot be decrypted.
 */
export function decryptToken(
  stored: string,
  context: string,
  key?: Buffer,
): string | null {
  if (!isEncryptedToken(stored)) return stored;

  const parts = stored.slice(TOKEN_ENCRYPTION_PREFIX.length).split(":");

  if (parts.length !== 3) return null;

  const [iv, authTag, cipherText] = parts.map((part) =>
    Buffer.from(part, "base64url"),
  ) as [Buffer, Buffer, Buffer];

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) return null;

  try {
    const decipher = createDecipheriv(ALGORITHM, requireKey(key), iv, {
      authTagLength: AUTH_TAG_BYTES,
    });

    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(cipherText),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
