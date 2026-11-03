<script setup lang="ts">
import type { SelectOption } from "naive-ui";

const emit = defineEmits<{ (e: "changed"): void }>();

const user = useUser();
const logwatch = useLogwatch();

const {
  data: adminsData,
  error: adminsError,
  refresh: refreshAdmins,
  status: adminsStatus,
} = await useFetch<{ data: AdminUserRow[] }>("/api/admin/admins", {
  headers: useRequestHeaders(["cookie"]),
  key: "admin-admins",
});

const admins = computed(() => adminsData.value?.data ?? []);
const onlyOneAdmin = computed(() => admins.value.length <= 1);

// ===== Add admin search =====
const searchOptions = ref<SelectOption[]>([]);
const searchLoading = ref(false);
const selectedUserId = ref<string | null>(null);
const searchResults = ref<AdminUserRow[]>([]);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
// Bumped on every search, so a slower response to an older query can't
// replace the results for what the admin typed last
let latestSearch = 0;

const searchUsers = (query: string) => {
  if (searchTimer) clearTimeout(searchTimer);
  const search = ++latestSearch;

  if (!query.trim()) {
    searchOptions.value = [];
    searchResults.value = [];
    searchLoading.value = false;
    return;
  }

  searchLoading.value = true;

  searchTimer = setTimeout(async () => {
    try {
      const { data } = await $fetch<{ data: AdminUserRow[] }>(
        "/api/admin/users",
        {
          headers: useRequestHeaders(["cookie"]),
          query: { search: query },
        },
      );

      if (search !== latestSearch) return;

      searchResults.value = data;
      searchOptions.value = data.map((row) => ({
        disabled: row.role === "admin",
        label:
          row.role === "admin"
            ? `${row.username} (already admin)`
            : row.username,
        value: row.id,
      }));
    } catch (error) {
      if (search !== latestSearch) return;

      console.error("Failed to search users:", error);
      logwatch.error("admin.searchUsers", "Failed to search users", {
        error,
      });
      searchOptions.value = [];
    } finally {
      if (search === latestSearch) searchLoading.value = false;
    }
  }, 250);
};

// ===== Confirmation =====
// Admin access is powerful, so both granting and removing it ask the admin to
// type the username before the change is made
const pendingChange = ref<{
  id: string;
  username: string;
  role: "admin" | "user";
} | null>(null);
const confirmUsername = ref("");
const savingRole = ref(false);

const confirmMatches = computed(
  () =>
    !!pendingChange.value &&
    confirmUsername.value.trim().toLowerCase() ===
      pendingChange.value.username.toLowerCase(),
);

const requestGrant = () => {
  const target = searchResults.value.find(
    (row) => row.id === selectedUserId.value,
  );
  if (!target) return;

  confirmUsername.value = "";
  pendingChange.value = {
    id: target.id,
    username: target.username,
    role: "admin",
  };
};

const requestRevoke = (row: AdminUserRow) => {
  confirmUsername.value = "";
  pendingChange.value = { id: row.id, username: row.username, role: "user" };
};

const cancelChange = () => {
  pendingChange.value = null;
  confirmUsername.value = "";
};

const applyChange = async () => {
  const change = pendingChange.value;
  if (!change || !confirmMatches.value || savingRole.value) return;

  savingRole.value = true;

  try {
    await $fetch(`/api/admin/users/${change.id}/role`, {
      body: { role: change.role },
      headers: useRequestHeaders(["cookie"]),
      method: "PATCH",
    });

    push.success({
      title: change.role === "admin" ? "Admin added" : "Admin removed",
      message:
        change.role === "admin"
          ? `${change.username} now has admin access.`
          : `${change.username} no longer has admin access.`,
    });

    pendingChange.value = null;
    selectedUserId.value = null;
    searchOptions.value = [];
    searchResults.value = [];

    await refreshAdmins();
    emit("changed");
  } catch (error: any) {
    console.error("Failed to update admin access:", error);
    logwatch.error("admin.updateRole", "Failed to update admin access", {
      error,
      role: change.role,
      userId: change.id,
    });
    push.error({
      title: "Failed to update admin access",
      message: error?.data?.statusMessage ?? "Please try again later",
    });
  } finally {
    savingRole.value = false;
  }
};

const revokeDisabledReason = (row: AdminUserRow) => {
  if (row.id === user.value?.id)
    return "You can't remove your own admin access";
  if (onlyOneAdmin.value) return "Codefair needs at least one admin";
  return "";
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
</script>

<template>
  <n-flex vertical size="large" class="pt-4">
    <n-alert type="info" title="Who can be an admin">
      Admins can pause Codefair workflows and add or remove other admins.
      Someone has to sign in to Codefair at least once before they can be made
      an admin. Access changes apply on their next request.
    </n-alert>

    <n-card title="Add an admin" class="shadow-md">
      <n-flex align="center" :wrap="false">
        <n-select
          v-model:value="selectedUserId"
          filterable
          remote
          clearable
          placeholder="Search by GitHub username"
          :options="searchOptions"
          :loading="searchLoading"
          :clear-filter-after-select="false"
          class="max-w-md"
          @search="searchUsers"
        />

        <n-button
          type="primary"
          :disabled="!selectedUserId"
          @click="requestGrant"
        >
          <template #icon>
            <Icon name="material-symbols:person-add" size="16" />
          </template>
          Add admin
        </n-button>
      </n-flex>
    </n-card>

    <n-alert v-if="adminsError" type="error" title="Could not load admins">
      Please refresh the page and try again.
    </n-alert>

    <n-card v-else title="Current admins" class="shadow-md">
      <n-spin :show="adminsStatus === 'pending'">
        <n-list>
          <n-list-item v-for="row in admins" :key="row.id">
            <n-flex align="center" justify="space-between">
              <n-flex align="center">
                <n-avatar
                  round
                  :size="40"
                  :src="`https://avatars.githubusercontent.com/u/${row.github_id}?s=80`"
                />

                <div class="flex flex-col">
                  <NuxtLink
                    :to="`https://github.com/${row.username}`"
                    target="_blank"
                    class="font-semibold"
                  >
                    {{ row.username }}
                    <span v-if="row.id === user?.id" class="font-normal">
                      (you)
                    </span>
                  </NuxtLink>

                  <span class="text-sm text-[var(--gray-700-200)]">
                    GitHub ID {{ row.github_id }} · Last signed in
                    {{ formatDateTime(row.last_login) }}
                  </span>
                </div>
              </n-flex>

              <n-tooltip :disabled="!revokeDisabledReason(row)">
                <template #trigger>
                  <n-button
                    type="error"
                    secondary
                    :disabled="!!revokeDisabledReason(row)"
                    @click="requestRevoke(row)"
                  >
                    Remove admin
                  </n-button>
                </template>

                {{ revokeDisabledReason(row) }}
              </n-tooltip>
            </n-flex>
          </n-list-item>
        </n-list>
      </n-spin>
    </n-card>

    <n-modal
      :show="!!pendingChange"
      preset="card"
      :bordered="false"
      size="huge"
      class="w-[550px] dark:bg-gray-800"
      @update:show="(show: boolean) => !show && cancelChange()"
    >
      <template #header>
        <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">
          {{
            pendingChange?.role === "admin"
              ? "Give admin access?"
              : "Remove admin access?"
          }}
        </h2>
      </template>

      <n-flex vertical>
        <p v-if="pendingChange?.role === 'admin'">
          <strong>{{ pendingChange?.username }}</strong> will be able to pause
          Codefair workflows and add or remove admins.
        </p>

        <p v-else>
          <strong>{{ pendingChange?.username }}</strong> will lose access to the
          admin panel on their next request.
        </p>

        <n-form-item
          :label="`Type ${pendingChange?.username} to confirm`"
          :show-feedback="false"
        >
          <n-input
            v-model:value="confirmUsername"
            autocomplete="off"
            :placeholder="pendingChange?.username"
            @keyup.enter="applyChange"
          />
        </n-form-item>
      </n-flex>

      <template #footer>
        <n-flex justify="end">
          <n-button @click="cancelChange">Cancel</n-button>

          <n-button
            :type="pendingChange?.role === 'admin' ? 'primary' : 'error'"
            :disabled="!confirmMatches"
            :loading="savingRole"
            @click="applyChange"
          >
            {{ pendingChange?.role === "admin" ? "Add admin" : "Remove admin" }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>
  </n-flex>
</template>
