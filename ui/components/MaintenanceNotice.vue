<script setup lang="ts">
import {
  MAINTENANCE_LABELS,
  ZENODO_OFF_LABEL,
  type MaintenanceKey,
} from "#shared/utils/maintenance";

const props = defineProps<{
  /**
   * Which paused workflow this notice speaks for. "zenodo" shows while Zenodo
   * is off, which is when both Zenodo sign-in switches are paused.
   */
  maintenanceKey: MaintenanceKey | "zenodo";
}>();

const { entryFor, zenodo } = useMaintenance();

const entry = computed(() =>
  props.maintenanceKey === "zenodo"
    ? zenodo.value.off
    : entryFor(props.maintenanceKey),
);

const label = computed(() =>
  props.maintenanceKey === "zenodo"
    ? ZENODO_OFF_LABEL
    : MAINTENANCE_LABELS[props.maintenanceKey],
);

const since = computed(() => {
  const value = entry.value?.since;
  if (!value) return "";

  return new Date(value).toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
});
</script>

<template>
  <n-alert v-if="entry" type="warning" :title="`${label} is paused`">
    <template #icon>
      <Icon name="material-symbols:build" size="20" />
    </template>

    <p>{{ entry.message }}</p>

    <p v-if="since" class="mt-1 text-xs opacity-80">Paused since {{ since }}</p>
  </n-alert>
</template>
