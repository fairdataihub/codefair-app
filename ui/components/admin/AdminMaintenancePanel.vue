<script setup lang="ts">
import {
  MAINTENANCE_LABELS,
  ZENODO_MODE_LABELS,
  ZENODO_SIGN_IN_KEYS,
  isZenodoSignInKey,
  zenodoModeFor,
  zenodoSwitchesFor,
  type ZenodoMode,
} from "#shared/utils/maintenance";

const emit = defineEmits<{ (e: "changed"): void }>();

const { refresh: refreshPublicMaintenance } = useMaintenance();
const logwatch = useLogwatch();

const {
  data: maintenanceData,
  error: maintenanceError,
  refresh: refreshMaintenance,
  status: maintenanceStatus,
} = await useFetch<{ data: AdminMaintenanceRow[] }>("/api/admin/maintenance", {
  headers: useRequestHeaders(["cookie"]),
  key: "admin-maintenance",
});

const flags = computed(() => maintenanceData.value?.data ?? []);
const zenodoOAuthRow = computed(() =>
  flags.value.find((row) => row.key === "zenodoOAuth"),
);
const zenodoTokenRow = computed(() =>
  flags.value.find((row) => row.key === "zenodoToken"),
);

type Draft = { enabled: boolean; message: string };

// Local edits per key, saved together
const drafts = ref<Record<string, Draft>>({});

const seedDrafts = (rows: AdminMaintenanceRow[]) => {
  const next: Record<string, Draft> = {};
  for (const row of rows) {
    next[row.key] = { enabled: row.enabled, message: row.message };
  }
  drafts.value = next;
};

watch(flags, seedDrafts, { immediate: true });

// Reads never create entries, so computed getters stay free of side effects
const readDraft = (key: string): Draft =>
  drafts.value[key] ?? { enabled: false, message: "" };

const ensureDraft = (key: string): Draft => {
  if (!drafts.value[key]) {
    drafts.value[key] = { enabled: false, message: "" };
  }
  return drafts.value[key];
};

const rowIsDirty = (row: AdminMaintenanceRow) => {
  const draft = readDraft(row.key);
  return draft.enabled !== row.enabled || draft.message !== row.message;
};

const dirtyRows = computed(() => flags.value.filter(rowIsDirty));
const isDirty = computed(() => dirtyRows.value.length > 0);
const newlyPausedRows = computed(() =>
  dirtyRows.value.filter((row) => readDraft(row.key).enabled && !row.enabled),
);

const savedZenodoMode = computed(() =>
  zenodoModeFor({
    zenodoOAuth: zenodoOAuthRow.value?.enabled ?? false,
    zenodoToken: zenodoTokenRow.value?.enabled ?? false,
  }),
);

// The Zenodo card writes one message, saved on both switches
const zenodoMessage = computed({
  get: () => readDraft("zenodoOAuth").message,
  set: (message: string) => {
    for (const key of ZENODO_SIGN_IN_KEYS) ensureDraft(key).message = message;
  },
});

const zenodoMode = computed<ZenodoMode>({
  get: () =>
    zenodoModeFor({
      zenodoOAuth: readDraft("zenodoOAuth").enabled,
      zenodoToken: readDraft("zenodoToken").enabled,
    }),
  set: (mode) => {
    if (mode === zenodoMode.value) return;

    const switches = zenodoSwitchesFor(mode);
    const backToSaved = mode === savedZenodoMode.value;

    // A message written for one mode rarely fits another, so a new mode
    // starts from the default and going back restores what was saved
    for (const key of ZENODO_SIGN_IN_KEYS) {
      const saved = flags.value.find((row) => row.key === key);
      const draft = ensureDraft(key);
      draft.enabled = switches[key];
      draft.message = backToSaved ? (saved?.message ?? "") : "";
    }
  },
});

const zenodoDirty = computed(() =>
  dirtyRows.value.some((row) => isZenodoSignInKey(row.key)),
);

// Collapses the two Zenodo switches into one "Zenodo set to X" line
const changeLabels = (rows: AdminMaintenanceRow[]) => {
  const labels = rows
    .filter((row) => !isZenodoSignInKey(row.key))
    .map((row) => MAINTENANCE_LABELS[row.key]);

  if (rows.some((row) => isZenodoSignInKey(row.key))) {
    labels.push(`Zenodo set to ${ZENODO_MODE_LABELS[zenodoMode.value]}`);
  }

  return labels;
};

const dirtyLabels = computed(() => changeLabels(dirtyRows.value));
const newlyPausedLabels = computed(() => changeLabels(newlyPausedRows.value));

const saving = ref(false);
const confirmOpen = ref(false);

const save = async () => {
  if (!isDirty.value || saving.value) return;

  saving.value = true;
  confirmOpen.value = false;

  const labels = dirtyLabels.value;
  const flagsToSave = dirtyRows.value.map((row) => ({
    enabled: readDraft(row.key).enabled,
    key: row.key,
    message: readDraft(row.key).message,
  }));

  try {
    await $fetch("/api/admin/maintenance", {
      body: { flags: flagsToSave },
      headers: useRequestHeaders(["cookie"]),
      method: "PUT",
    });

    push.success({
      title: "Maintenance updated",
      message: `${labels.join(". ")}.`,
    });

    await Promise.all([refreshMaintenance(), refreshPublicMaintenance()]);
    emit("changed");
  } catch (error: any) {
    console.error("Failed to update maintenance:", error);
    logwatch.error("admin.updateMaintenance", "Failed to update maintenance", {
      error,
      keys: flagsToSave.map((flag) => flag.key),
    });
    push.error({
      title: "Failed to update maintenance",
      message: error?.data?.statusMessage ?? "Please try again later",
    });
  } finally {
    saving.value = false;
  }
};

const requestSave = () => {
  if (!isDirty.value || saving.value) return;

  // Pausing stops users, so it asks first
  if (newlyPausedRows.value.length > 0) {
    confirmOpen.value = true;
    return;
  }

  save();
};

const resetAll = () => {
  seedDrafts(flags.value);
};
</script>

<template>
  <n-flex vertical size="large" class="pt-4">
    <n-alert type="info" title="How maintenance switches work">
      Pausing a workflow takes effect within about ten seconds. Users see the
      message you write here, and requests to a paused workflow are rejected on
      the server. Every change is recorded in the audit log.
    </n-alert>

    <n-alert
      v-if="maintenanceError"
      type="error"
      title="Could not load maintenance switches"
    >
      Please refresh the page and try again.
    </n-alert>

    <n-spin v-else :show="maintenanceStatus === 'pending'">
      <n-flex vertical size="large">
        <div
          class="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700"
        >
          <p class="text-sm">
            <template v-if="isDirty">
              {{
                dirtyRows.length === 1 ? "1 unsaved change" : "Unsaved changes"
              }}:
              {{ dirtyLabels.join(", ") }}
            </template>

            <template v-else>Save any changes to apply them.</template>
          </p>

          <n-flex>
            <n-button :disabled="!isDirty || saving" @click="resetAll">
              Reset
            </n-button>

            <n-button
              type="primary"
              :disabled="!isDirty"
              :loading="saving"
              @click="requestSave"
            >
              Save changes
            </n-button>
          </n-flex>
        </div>

        <AdminMaintenanceZenodoCard
          v-if="zenodoOAuthRow && zenodoTokenRow"
          v-model:mode="zenodoMode"
          v-model:message="zenodoMessage"
          :oauth-row="zenodoOAuthRow"
          :token-row="zenodoTokenRow"
          :dirty="zenodoDirty"
        />
      </n-flex>
    </n-spin>

    <n-modal
      v-model:show="confirmOpen"
      preset="card"
      :bordered="false"
      size="huge"
      class="w-[550px] dark:bg-gray-800"
    >
      <template #header>
        <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">
          Pause these workflows?
        </h2>
      </template>

      <p>Users will not be able to use them until you switch them back on.</p>

      <ul class="list-inside list-disc pt-2">
        <li v-for="label in newlyPausedLabels" :key="label">{{ label }}</li>
      </ul>

      <template #footer>
        <n-flex justify="end">
          <n-button @click="confirmOpen = false">Cancel</n-button>

          <n-button type="warning" :loading="saving" @click="save">
            {{
              newlyPausedLabels.length === 1
                ? "Pause workflow"
                : `Pause ${newlyPausedLabels.length} workflows`
            }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>
  </n-flex>
</template>
