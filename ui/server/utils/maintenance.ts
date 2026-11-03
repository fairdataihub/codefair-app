import {
  isMaintenanceKey,
  resolveMaintenanceMessage,
  resolveZenodoMaintenance,
  type ActiveMaintenance,
  type MaintenanceKey,
} from "#shared/utils/maintenance";
import prisma from "~/server/utils/prisma";

// Admins toggle these from /admin, so the hot release paths would otherwise
// pay for an extra query on every request. The cache is per process: on a
// multi instance deploy a toggle takes up to CACHE_TTL_MS to reach every
// instance, which is fine for a maintenance switch.
const CACHE_TTL_MS = 10_000;

let cache: { at: number; value: ActiveMaintenance[] } | null = null;

/**
 * Drops the cached switches so the next read goes to the database.
 */
export function invalidateMaintenanceCache() {
  cache = null;
}

/**
 * @returns Every maintenance switch that is currently on.
 */
export async function getActiveMaintenance(): Promise<ActiveMaintenance[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  const rows = await prisma.maintenanceFlag.findMany({
    select: { enabled_at: true, key: true, message: true },
    where: { enabled: true },
  });

  const value = rows.flatMap<ActiveMaintenance>((row) => {
    // A key retired from the code but left in the database must not block anything.
    if (!isMaintenanceKey(row.key)) return [];

    return [
      {
        key: row.key,
        message: resolveMaintenanceMessage(row.key, row.message),
        since: row.enabled_at?.toISOString() ?? null,
        usesDefaultMessage: !row.message.trim(),
      },
    ];
  });

  cache = { at: Date.now(), value };

  return value;
}

/**
 * @param key - Maintenance key to check.
 * @returns True when that workflow is paused.
 */
export async function isUnderMaintenance(key: MaintenanceKey) {
  const active = await getActiveMaintenance();

  return active.some((entry) => entry.key === key);
}

/**
 * Throws 503 with the admin authored message when the workflow is paused.
 * Call it straight after the session check, before any external work.
 * @param key - Maintenance key that guards the workflow.
 */
export async function assertNotInMaintenance(key: MaintenanceKey) {
  const active = await getActiveMaintenance();
  const match = active.find((entry) => entry.key === key);

  if (match) {
    throw createError({
      data: { maintenance: key, message: match.message },
      statusCode: 503,
      statusMessage: match.message,
    });
  }
}

/**
 * Throws 503 while Zenodo is off, which is when both Zenodo sign-in switches
 * are paused (see resolveZenodoMaintenance). Guards publishing as well as
 * connecting, so users who are already connected are stopped too.
 */
export async function assertZenodoNotOff() {
  const { off } = resolveZenodoMaintenance(await getActiveMaintenance());

  if (off) {
    throw createError({
      data: { maintenance: "zenodo", message: off.message },
      statusCode: 503,
      statusMessage: off.message,
    });
  }
}
