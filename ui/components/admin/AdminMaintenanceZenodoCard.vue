<script setup lang="ts">
import {
  MAINTENANCE_FALLBACK_MESSAGES,
  ZENODO_MODES,
  ZENODO_MODE_DESCRIPTIONS,
  ZENODO_MODE_LABELS,
  ZENODO_OFF_FALLBACK_MESSAGE,
  zenodoModeFor,
  type ZenodoMode,
} from "#shared/utils/maintenance";

const props = defineProps<{
  dirty: boolean;
  oauthRow: AdminMaintenanceRow;
  tokenRow: AdminMaintenanceRow;
}>();

const mode = defineModel<ZenodoMode>("mode", { required: true });
const message = defineModel<string>("message", { required: true });

const savedMode = computed(() =>
  zenodoModeFor({
    zenodoOAuth: props.oauthRow.enabled,
    zenodoToken: props.tokenRow.enabled,
  }),
);

// Only these two modes show users a message
const showsMessage = computed(
  () => mode.value === "oauthPaused" || mode.value === "off",
);

const previewMessage = computed(
  () =>
    message.value.trim() ||
    (mode.value === "off"
      ? ZENODO_OFF_FALLBACK_MESSAGE
      : MAINTENANCE_FALLBACK_MESSAGES.zenodoOAuth),
);

const PREVIEW_NOTES: Record<ZenodoMode, string> = {
  live: "No notice. The release page offers the Login to Zenodo button with the personal access token form below it.",
  oauthPaused:
    "Shown on the release page in place of the Login to Zenodo button, followed by the steps to create a token. Users who are already connected are not affected.",
  off: "Shown at the top of the release page. Connecting and publishing to Zenodo are blocked.",
  tokenPaused:
    "No notice. The release page offers the Login to Zenodo button only. Users who are already connected are not affected.",
};

const modeTagType = (value: ZenodoMode) => {
  if (value === "live") return "success";
  return value === "off" ? "error" : "warning";
};

const rows = computed(() => [props.oauthRow, props.tokenRow]);

const pausedSince = computed(
  () =>
    rows.value
      .flatMap((row) => (row.enabled && row.enabledAt ? [row.enabledAt] : []))
      .sort()
      .at(-1) ?? null,
);

const lastChangedRow = computed(
  () =>
    rows.value
      .filter((row) => row.updatedAt !== null)
      .sort((a, b) => (a.updatedAt ?? "").localeCompare(b.updatedAt ?? ""))
      .at(-1) ?? null,
);

const formatDateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";
</script>

<template>
  <n-card
    class="shadow-md"
    :class="{ 'ring-2 ring-indigo-500': dirty }"
    title="Zenodo publishing"
  >
    <template #header-extra>
      <n-flex size="small">
        <n-tag :type="modeTagType(savedMode)" :bordered="false" size="small">
          {{ ZENODO_MODE_LABELS[savedMode] }}
        </n-tag>

        <n-tag v-if="dirty" type="info" :bordered="false" size="small">
          {{
            mode === savedMode
              ? "Message changed"
              : `Will change to ${ZENODO_MODE_LABELS[mode]}`
          }}
        </n-tag>
      </n-flex>
    </template>

    <n-flex vertical size="large">
      <p class="text-sm text-[var(--gray-700-200)]">
        Users connect Zenodo with the Login to Zenodo button (OAuth) or a
        personal access token. Pause OAuth while Zenodo's sign-in is failing, or
        turn Zenodo off to stop all connecting and publishing.
      </p>

      <n-radio-group v-model:value="mode" name="zenodo-mode">
        <div class="grid gap-2 sm:grid-cols-2">
          <label
            v-for="value in ZENODO_MODES"
            :key="value"
            class="flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors"
            :class="
              mode === value
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                : 'border-slate-200 dark:border-slate-700'
            "
          >
            <n-radio :value="value" />

            <div class="flex flex-col">
              <span class="font-semibold">{{ ZENODO_MODE_LABELS[value] }}</span>

              <span class="text-sm text-[var(--gray-700-200)]">
                {{ ZENODO_MODE_DESCRIPTIONS[value] }}
              </span>
            </div>
          </label>
        </div>
      </n-radio-group>

      <n-form-item
        v-if="showsMessage"
        label="Message shown to users"
        :show-feedback="false"
      >
        <n-input
          v-model:value="message"
          type="textarea"
          :maxlength="500"
          show-count
          :rows="3"
          :placeholder="`Leave blank to use the default: ${mode === 'off' ? ZENODO_OFF_FALLBACK_MESSAGE : MAINTENANCE_FALLBACK_MESSAGES.zenodoOAuth}`"
        />
      </n-form-item>

      <div>
        <p class="pb-2 font-semibold">What users see</p>

        <n-alert
          v-if="mode === 'off'"
          type="warning"
          title="Zenodo publication is paused"
        >
          {{ previewMessage }}
        </n-alert>

        <p
          v-else-if="mode === 'oauthPaused'"
          class="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700"
        >
          {{ previewMessage }}
        </p>

        <p class="pt-2 text-sm text-[var(--gray-700-200)]">
          {{ PREVIEW_NOTES[mode] }}
        </p>
      </div>

      <dl class="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt class="text-[var(--gray-700-200)]">Paused since</dt>

          <dd>{{ formatDateTime(pausedSince) }}</dd>
        </div>

        <div>
          <dt class="text-[var(--gray-700-200)]">Last changed</dt>

          <dd>{{ formatDateTime(lastChangedRow?.updatedAt ?? null) }}</dd>
        </div>

        <div>
          <dt class="text-[var(--gray-700-200)]">Changed by</dt>

          <dd>{{ lastChangedRow?.updatedBy?.username ?? "-" }}</dd>
        </div>
      </dl>
    </n-flex>
  </n-card>
</template>
