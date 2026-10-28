import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { parseTokenEncryptionKey } from "~/server/utils/tokenCrypto";

// Long enough for a few retries
const MAX_AGE_MS = 30 * 60 * 1000;

export interface ZenodoOAuthState {
  githubDetails: { githubRelease?: string; githubTag?: string };
  issuedAt?: number;
  owner: string;
  repo: string;
  sig?: string;
}

export type ZenodoOAuthStateCheck = "expired" | "invalid" | "valid";

// A key of its own for signing, derived from TOKEN_ENCRYPTION_KEY so the
// encryption key is never used for anything else
function signingKey(): Buffer {
  const key = parseTokenEncryptionKey(process.env.TOKEN_ENCRYPTION_KEY);

  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is missing or is not 32 bytes of base64",
    );
  }

  return Buffer.from(
    hkdfSync("sha256", key, "", "codefair:zenodo-oauth-state", 32),
  );
}

function signature(userId: string, state: ZenodoOAuthState): string {
  // Fixed field order, so the signature doesn't depend on how the JSON was
  // serialized on the way back from Zenodo
  const signed = JSON.stringify([
    userId,
    state.owner,
    state.repo,
    state.githubDetails?.githubRelease ?? "",
    state.githubDetails?.githubTag ?? "",
    state.issuedAt,
  ]);

  return createHmac("sha256", signingKey()).update(signed).digest("base64url");
}

/**
 * Builds the OAuth state for a Zenodo sign-in. The callback only accepts it for that same user, so a
 * crafted callback URL cannot attach a Zenodo account to someone else's
 * Codefair account.
 * @param userId - The signed-in user starting the sign-in.
 * @param details - Where to send the user back to after signing in.
 * @returns The state to pass to Zenodo.
 */
export function signZenodoOAuthState(
  userId: string,
  details: Pick<ZenodoOAuthState, "githubDetails" | "owner" | "repo">,
): string {
  const state: ZenodoOAuthState = { ...details, issuedAt: Date.now() };

  return JSON.stringify({ ...state, sig: signature(userId, state) });
}

/**
 * Checks that the state Zenodo sent back was signed for this user and is
 * recent. The same state stays valid for retries until it expires.
 * @param state - The parsed state from the callback.
 * @param userId - The signed-in user finishing the sign-in.
 * @returns "valid", "expired", or "invalid" when it was signed for someone else
 * or not by Codefair.
 */
export function checkZenodoOAuthState(
  state: ZenodoOAuthState,
  userId: string,
): ZenodoOAuthStateCheck {
  if (typeof state.sig !== "string" || typeof state.issuedAt !== "number") {
    return "invalid";
  }

  const expected = Buffer.from(signature(userId, state));
  const actual = Buffer.from(state.sig);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return "invalid";
  }

  const age = Date.now() - state.issuedAt;

  return age < 0 || age > MAX_AGE_MS ? "expired" : "valid";
}
