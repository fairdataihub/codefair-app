/**
 * Runtime maintenance switches. These live in the database so an admin can
 * pause a workflow from /admin without a redeploy. Shared by the client and
 * the server, imported as #shared/utils/maintenance.
 */

export const MAINTENANCE_KEYS = ["zenodoOAuth", "zenodoToken"] as const;

export type MaintenanceKey = (typeof MAINTENANCE_KEYS)[number];

export const MAINTENANCE_LABELS: Record<MaintenanceKey, string> = {
  zenodoOAuth: "Zenodo OAuth sign-in",
  zenodoToken: "Zenodo personal access token sign-in",
};

export const MAINTENANCE_DESCRIPTIONS: Record<MaintenanceKey, string> = {
  zenodoOAuth: "The Login to Zenodo button on the release page.",
  zenodoToken: "Connecting Zenodo by pasting a personal access token.",
};

export const MAINTENANCE_FALLBACK_MESSAGES: Record<MaintenanceKey, string> = {
  // Shown above the personal access token form, which explains what to do next.
  zenodoOAuth: "Signing in with your Zenodo account is paused for maintenance.",
  zenodoToken:
    "Connecting Zenodo with a personal access token is paused for maintenance. Please try again shortly.",
};

/**
 * @param value - Any value, usually a database key.
 * @returns True when the value is a maintenance key this version knows about.
 */
export function isMaintenanceKey(value: unknown): value is MaintenanceKey {
  return (
    typeof value === "string" &&
    (MAINTENANCE_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Falls back to a sensible default when an admin leaves the message blank.
 * @param key - Maintenance key the message belongs to.
 * @param message - Admin authored message, possibly blank.
 * @returns The message to show users.
 */
export function resolveMaintenanceMessage(
  key: MaintenanceKey,
  message?: string | null,
): string {
  const trimmed = message?.trim();

  return trimmed || MAINTENANCE_FALLBACK_MESSAGES[key];
}

export type ActiveMaintenance = {
  key: MaintenanceKey;
  message: string;
  since: string | null;
  // True when the admin left the message blank and `message` is the default.
  usesDefaultMessage: boolean;
};

/*
 * Zenodo publishing has no switch of its own. Users connect their Zenodo
 * account with OAuth sign-in or a personal access token, each with a switch,
 * and pausing both turns Zenodo off: nobody can connect or publish, including
 * users who are already connected. The admin panel edits the pair as one card
 * with these four modes, and users see at most one notice for them.
 */
export const ZENODO_SIGN_IN_KEYS = [
  "zenodoOAuth",
  "zenodoToken",
] as const satisfies readonly MaintenanceKey[];

export type ZenodoSignInKey = (typeof ZENODO_SIGN_IN_KEYS)[number];

/**
 * @param value - A maintenance key.
 * @returns True when the key is one of the two Zenodo sign-in switches.
 */
export function isZenodoSignInKey(value: string): value is ZenodoSignInKey {
  return (ZENODO_SIGN_IN_KEYS as readonly string[]).includes(value);
}

export const ZENODO_MODES = [
  "live",
  "oauthPaused",
  "tokenPaused",
  "off",
] as const;

export type ZenodoMode = (typeof ZENODO_MODES)[number];

/**
 * @param paused - Whether each Zenodo sign-in switch is paused.
 * @returns The Zenodo mode those switches add up to.
 */
export function zenodoModeFor(
  paused: Record<ZenodoSignInKey, boolean>,
): ZenodoMode {
  if (paused.zenodoOAuth && paused.zenodoToken) return "off";
  if (paused.zenodoOAuth) return "oauthPaused";
  if (paused.zenodoToken) return "tokenPaused";

  return "live";
}

/**
 * @param mode - A Zenodo mode.
 * @returns Whether each Zenodo sign-in switch is paused in that mode.
 */
export function zenodoSwitchesFor(
  mode: ZenodoMode,
): Record<ZenodoSignInKey, boolean> {
  return {
    zenodoOAuth: mode === "oauthPaused" || mode === "off",
    zenodoToken: mode === "tokenPaused" || mode === "off",
  };
}

export const ZENODO_MODE_LABELS: Record<ZenodoMode, string> = {
  live: "Live",
  oauthPaused: "OAuth paused",
  off: "Off",
  tokenPaused: "Tokens paused",
};

export const ZENODO_MODE_DESCRIPTIONS: Record<ZenodoMode, string> = {
  live: "Users connect with the Login to Zenodo button or a personal access token.",
  oauthPaused:
    "Users connect with a personal access token only. Use this when Zenodo's OAuth is failing.",
  off: "Nobody can connect or publish to Zenodo, including users who are already connected.",
  tokenPaused: "Users connect with the Login to Zenodo button only.",
};

/** Title of the one notice users see while Zenodo is off. */
export const ZENODO_OFF_LABEL = "Zenodo publication";

export const ZENODO_OFF_FALLBACK_MESSAGE =
  "Publishing to Zenodo is paused for maintenance. Please try again shortly.";

export type ZenodoMaintenance = {
  mode: ZenodoMode;
  /** The notice to show while Zenodo is off, null in every other mode. */
  off: { message: string; since: string | null } | null;
};

/**
 * Reads the active switches as one Zenodo mode.
 * @param active - Every maintenance switch that is currently on.
 * @returns The Zenodo mode, plus the notice to show while Zenodo is off.
 */
export function resolveZenodoMaintenance(
  active: readonly ActiveMaintenance[],
): ZenodoMaintenance {
  const oauth = active.find((entry) => entry.key === "zenodoOAuth");
  const token = active.find((entry) => entry.key === "zenodoToken");
  const mode = zenodoModeFor({ zenodoOAuth: !!oauth, zenodoToken: !!token });

  if (!oauth || !token) return { mode, off: null };

  // The admin panel saves one message on both rows. Each row's default speaks
  // for a single way of connecting, so a blank message gets the off default.
  const custom = [oauth, token].find((entry) => !entry.usesDefaultMessage);
  // Zenodo went off when the second switch was paused.
  const since =
    [oauth.since, token.since]
      .filter((value) => value !== null)
      .sort()
      .at(-1) ?? null;

  return {
    mode,
    off: { message: custom?.message ?? ZENODO_OFF_FALLBACK_MESSAGE, since },
  };
}
