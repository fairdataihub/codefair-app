<script setup lang="ts">
import { NEllipsis, NTag, type DataTableColumns } from "naive-ui";
import { MAINTENANCE_LABELS } from "#shared/utils/maintenance";

const LIMIT = 25;

const page = ref(1);
const actionFilter = ref<string | null>(null);

watch(actionFilter, () => {
  page.value = 1;
});

// The admin page refreshes this through refreshNuxtData("admin-audit-log")
// whenever a panel adds an entry
const { data: auditData, status: auditStatus } = await useFetch<{
  data: AdminAuditLogRow[];
  limit: number;
  page: number;
  total: number;
}>("/api/admin/audit-log", {
  headers: useRequestHeaders(["cookie"]),
  key: "admin-audit-log",
  query: computed(() => ({
    action: actionFilter.value ?? "",
    limit: LIMIT,
    page: page.value,
  })),
});

const rows = computed(() => auditData.value?.data ?? []);
const total = computed(() => auditData.value?.total ?? 0);

const ACTION_LABELS: Record<string, string> = {
  DECRYPT_TOKENS: "Decrypted tokens",
  ENCRYPT_TOKENS: "Encrypted tokens",
  GRANT_ADMIN: "Granted admin",
  REVOKE_ADMIN: "Revoked admin",
  UPDATE_MAINTENANCE: "Updated maintenance",
};

const actionOptions = Object.entries(ACTION_LABELS).map(([value, label]) => ({
  label,
  value,
}));

const actionTagType = (action: string) => {
  if (action.startsWith("REVOKE") || action.startsWith("DECRYPT")) {
    return "error";
  }
  if (action.startsWith("UPDATE")) return "warning";
  if (action.startsWith("GRANT")) return "success";
  return "default";
};

const detailSummary = (row: AdminAuditLogRow): string => {
  const details = row.details ?? {};

  if (row.action === "UPDATE_MAINTENANCE") {
    const label =
      MAINTENANCE_LABELS[row.entityId as keyof typeof MAINTENANCE_LABELS] ??
      row.entityId;
    const state = details.enabled ? "paused" : "live";
    const message =
      typeof details.message === "string" && details.message
        ? `: ${details.message}`
        : "";
    return `${label} set to ${state}${message}`;
  }

  if (row.action === "GRANT_ADMIN" || row.action === "REVOKE_ADMIN") {
    const verb = row.action === "GRANT_ADMIN" ? "Made" : "Removed";
    const suffix = row.action === "GRANT_ADMIN" ? "an admin" : "as admin";
    return `${verb} ${details.username ?? row.entityId} ${suffix}`;
  }

  if (row.action === "ENCRYPT_TOKENS" || row.action === "DECRYPT_TOKENS") {
    return `GitHub tokens: ${details.githubTokens ?? 0}, Zenodo tokens: ${details.zenodoTokens ?? 0}, Zenodo refresh tokens: ${details.zenodoRefreshTokens ?? 0}, skipped: ${details.skipped ?? 0}`;
  }

  return row.details ? JSON.stringify(row.details) : "";
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });

const columns: DataTableColumns<AdminAuditLogRow> = [
  {
    title: "Date",
    key: "createdAt",
    render: (row) => formatDateTime(row.createdAt),
    width: 190,
  },
  {
    title: "Actor",
    key: "actorLabel",
    render: (row) => row.actor?.username ?? row.actorLabel,
    width: 170,
  },
  {
    title: "Action",
    key: "action",
    render: (row) =>
      h(
        NTag,
        { bordered: false, size: "small", type: actionTagType(row.action) },
        { default: () => ACTION_LABELS[row.action] ?? row.action },
      ),
    width: 190,
  },
  {
    title: "Entity",
    key: "entity",
    render: (row) =>
      h(
        "span",
        { class: "font-mono text-sm" },
        `${row.entityType}:${row.entityId}`,
      ),
    width: 220,
  },
  {
    title: "Details",
    key: "details",
    render: (row) =>
      h(
        NEllipsis,
        { lineClamp: 2, tooltip: { width: 400 } },
        { default: () => detailSummary(row) },
      ),
  },
];

const pagination = computed(() => ({
  itemCount: total.value,
  page: page.value,
  pageSize: LIMIT,
  prefix: ({ itemCount }: { itemCount?: number }) =>
    `${itemCount ?? 0} entries`,
}));

const onUpdatePage = (next: number) => {
  page.value = next;
};
</script>

<template>
  <n-flex vertical size="large" class="pt-4">
    <n-flex align="center" justify="space-between">
      <n-select
        v-model:value="actionFilter"
        clearable
        placeholder="All actions"
        :options="actionOptions"
        class="w-60"
      />

      <span class="text-sm text-[var(--gray-700-200)]">
        {{ total }} {{ total === 1 ? "entry" : "entries" }}
      </span>
    </n-flex>

    <n-data-table
      remote
      :columns="columns"
      :data="rows"
      :loading="auditStatus === 'pending'"
      :pagination="pagination"
      :row-key="(row: AdminAuditLogRow) => row.id"
      :scroll-x="1000"
      @update:page="onUpdatePage"
    />
  </n-flex>
</template>
