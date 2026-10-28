import {
  resolveZenodoMaintenance,
  type ActiveMaintenance,
  type MaintenanceKey,
} from "#shared/utils/maintenance";

/**
 * Which workflows an admin has paused. Shared across every consumer on a page
 * through a single keyed fetch. The server enforces every switch on its own,
 * so this only drives notices and disabled buttons.
 */
export function useMaintenance() {
  const { data, refresh, status } = useFetch<{ active: ActiveMaintenance[] }>(
    "/api/maintenance",
    { default: () => ({ active: [] }), key: "maintenance" },
  );

  const active = computed(() => data.value?.active ?? []);

  const entryFor = (key: MaintenanceKey) =>
    active.value.find((entry) => entry.key === key) ?? null;

  const isActive = (key: MaintenanceKey) => entryFor(key) !== null;

  const messageFor = (key: MaintenanceKey) => entryFor(key)?.message ?? "";

  // The two Zenodo sign-in switches read as one mode, and Zenodo is off when
  // both are paused.
  const zenodo = computed(() => resolveZenodoMaintenance(active.value));

  return { active, entryFor, isActive, messageFor, refresh, status, zenodo };
}
