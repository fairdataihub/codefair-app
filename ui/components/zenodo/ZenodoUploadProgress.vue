<script setup lang="ts">
const props = defineProps<{
  upload: ZenodoUploadProgress;
}>();

// Longer lists collapse to the in-flight files so the modal keeps its height.
const COLLAPSE_AFTER = 5;

const statusLabels: Record<ZenodoUploadFileStatus, string> = {
  committing: "Finalizing on Zenodo",
  completed: "Uploaded",
  downloading: "Downloading from GitHub",
  error: "Failed",
  pending: "Waiting",
  retrying: "Upload failed, retrying",
  uploading: "Uploading to Zenodo",
};

// Static per-state icons; the step row above already carries the spinner.
const statusIcons: Record<
  ZenodoUploadFileStatus,
  { name: string; class: string }
> = {
  committing: { name: "mdi:dots-horizontal-circle", class: "text-violet-500" },
  completed: { name: "mdi:check-circle", class: "text-green-500" },
  downloading: { name: "mdi:arrow-down-circle", class: "text-cyan-500" },
  error: { name: "mdi:alert-circle", class: "text-red-500" },
  pending: {
    name: "mdi:circle-outline",
    class: "text-gray-300 dark:text-gray-600",
  },
  retrying: { name: "mdi:refresh-circle", class: "text-amber-500" },
  uploading: { name: "mdi:arrow-up-circle", class: "text-blue-500" },
};

const activeStatuses: ZenodoUploadFileStatus[] = [
  "downloading",
  "uploading",
  "committing",
];

const expanded = ref(false);
const list = ref<HTMLElement | null>(null);

const total = computed(() => props.upload.files.length);
const uploaded = computed(
  () => props.upload.files.filter((file) => file.status === "completed").length,
);
const indexedFiles = computed(() =>
  props.upload.files.map((file, index) => ({ file, index })),
);
// Several files transfer at once; failed ones stay listed here too.
const activeFiles = computed(() =>
  indexedFiles.value.filter(
    ({ file }) => file.status !== "pending" && file.status !== "completed",
  ),
);
const firstActiveIndex = computed(() => activeFiles.value[0]?.index ?? -1);
const collapsed = computed(
  () => total.value > COLLAPSE_AFTER && !expanded.value,
);

const visibleFiles = computed(() =>
  collapsed.value ? activeFiles.value : indexedFiles.value,
);

// Sizes span bytes to gigabytes, so progress is measured in bytes rather
// than files. The source zip's size is unknown until it is downloaded.
const bytesTotal = computed(() =>
  props.upload.files.reduce((sum, file) => sum + (file.size ?? 0), 0),
);
const bytesUploaded = computed(() =>
  props.upload.files.reduce((sum, file) => {
    if (file.status === "completed") return sum + (file.size ?? 0);
    if (file.status === "uploading" || file.status === "committing") {
      return sum + (file.uploadedBytes ?? 0);
    }
    return sum;
  }, 0),
);
const percentage = computed(() => {
  if (bytesTotal.value > 0) {
    return Math.round((bytesUploaded.value / bytesTotal.value) * 100);
  }
  return total.value ? Math.round((uploaded.value / total.value) * 100) : 0;
});

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
};

const describeFile = (file: ZenodoUploadFileProgress) => {
  const parts = [statusLabels[file.status]];
  if (
    file.attempt &&
    file.attempt > 1 &&
    ["uploading", "committing", "retrying"].includes(file.status)
  ) {
    parts.push(`attempt ${file.attempt} of ${props.upload.maxAttempts}`);
  }
  if (file.size === undefined) return parts.join(" · ");
  parts.push(
    file.status === "uploading" && file.uploadedBytes
      ? `${formatBytes(file.uploadedBytes)} of ${formatBytes(file.size)}`
      : formatBytes(file.size),
  );
  return parts.join(" · ");
};

// Keeps the in-flight files in view while the expanded list grows past its
// max height.
watch([firstActiveIndex, expanded], async () => {
  if (!expanded.value) return;
  await nextTick();
  const row = list.value?.querySelector<HTMLElement>("[data-active]");
  if (!list.value || !row) return;
  list.value.scrollTop =
    row.offsetTop - (list.value.clientHeight - row.offsetHeight) / 2;
});
</script>

<template>
  <div class="space-y-2">
    <div class="space-y-1.5">
      <div
        class="flex items-baseline justify-between gap-3 text-sm text-gray-500 dark:text-gray-400"
      >
        <span>
          {{ uploaded }} of {{ total }}
          {{ total === 1 ? "file" : "files" }} uploaded
        </span>

        <span v-if="bytesTotal" class="shrink-0 text-xs tabular-nums">
          {{ formatBytes(bytesUploaded) }} of {{ formatBytes(bytesTotal) }}
        </span>
      </div>

      <div
        class="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
      >
        <div
          class="h-full rounded-full bg-blue-500 transition-all duration-500"
          :style="{ width: `${percentage}%` }"
        />
      </div>
    </div>

    <ul
      ref="list"
      class="relative space-y-1.5"
      :class="{ 'max-h-60 overflow-y-auto pr-3': expanded }"
    >
      <li
        v-for="{ file, index } in visibleFiles"
        :key="index"
        :data-active="index === firstActiveIndex || undefined"
        class="flex items-center gap-2 text-sm"
      >
        <Icon
          :name="statusIcons[file.status].name"
          class="h-4 w-4 shrink-0"
          :class="statusIcons[file.status].class"
        />

        <span
          class="min-w-0 flex-1 truncate"
          :class="{
            'font-medium text-gray-900 dark:text-gray-100':
              activeStatuses.includes(file.status) ||
              file.status === 'retrying',
            'text-gray-400 dark:text-gray-500': file.status === 'pending',
            'text-gray-700 dark:text-gray-300': file.status === 'completed',
            'text-red-600 dark:text-red-400': file.status === 'error',
          }"
          :title="file.name"
        >
          {{ file.name }}
        </span>

        <span
          class="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400"
        >
          {{ describeFile(file) }}
        </span>
      </li>
    </ul>

    <n-button
      v-if="total > COLLAPSE_AFTER"
      text
      size="tiny"
      type="primary"
      @click="expanded = !expanded"
    >
      <template #icon>
        <Icon :name="expanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
      </template>
      {{ expanded ? "Show less" : `Show all ${total} files` }}
    </n-button>
  </div>
</template>
