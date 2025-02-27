<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";
import { Icon } from "#components";

const route = useRoute();

const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.showBreadcrumbs();
breadcrumbsStore.setFeature({
  id: "",
  name: "",
  icon: "",
});

const { owner } = route.params as { owner: string };

const botNotInstalled = ref(false);
const renderIcon = (icon: string) => {
  return () => {
    return h(Icon, { name: icon });
  };
};

const { data, error } = await useFetch(`/api/${owner}/dashboard`, {
  headers: useRequestHeaders(["cookie"]),
});

if (error.value) {
  console.error(error.value);

  if (error.value.statusMessage === "installation-not-found") {
    // codefair bot is not installed on the repo.
    botNotInstalled.value = true;
  } else {
    push.error({
      title: "Something went wrong",
      message:
        "Could not fetch the data for the dashboard. Please try again later.",
    });

    throw createError(error.value);
  }
}

const filteredRepos = computed(() => {
  return data.value ? data.value.installations.filter((repo) => repo.action_count === 0) : [];
});

const settingsOptions = [
  {
    icon: renderIcon("mdi:github"),
    key: "view-org",
    label: "View Organization",
  },
  {
    icon: renderIcon("mdi:cog"),
    key: "view-codefair-settings",
    label: "View Codefair settings",
  },
  {
    key: "need-help-link",
    label: "Need help?",
    icon: renderIcon("mdi:help-circle-outline"),
  },
];

const handleSettingsSelect = (key: string) => {
  switch (key) {
    case "view-org":
      navigateTo(`https://github.com/${owner}`, {open: {target: "_blank"}});
      break;
    case "view-codefair-settings":
      if (data.value?.isOrganization) {
        navigateTo(
          `https://github.com/organizations/${owner}/settings/installations/${data.value?.installationId}`,
          {
            open: {
              target: "_blank",
            },
          },
        );
      } else {
        navigateTo(
          `https://github.com/settings/installations/${data.value?.installationId}`,
          {
            open: {
              target: "_blank",
            },
          },
        );
      }
      break;
    case "need-help-link":
      navigateTo("https://docs.codefair.io/docs/ui-dashboard.html", {open: {target: "_blank"}});
    default:
      console.log("Unknown action");
  }
};
</script>

<template>
<main class="mx-auto max-w-screen-xl px-8 pb-8 pt-4">
  <n-flex vertical>
    <!-- Header Section -->
    <div class="flex flex-row items-center justify-between">
      <h1 class="text-2xl font-bold">Apps being managed by Codefair</h1>

      <div class="flex flex-row items-center gap-4">
        <n-dropdown
          :options="settingsOptions"
          placement="bottom-end"
          :show-arrow="true"
          @select="handleSettingsSelect"
        >
          <n-button type="info" secondary size="large">
            <template #icon>
              <Icon name="ic:round-settings" size="16" />
            </template>
            Settings
          </n-button>
        </n-dropdown>
      </div>
    </div>

    <p class="mt-4 text-base text-gray-600">
      Some repositories may not appear here if they have not had any actions
      performed on their main branch yet. Once a couple of actions have been
      processed, the repositories will appear in the list.
    </p>

    <n-divider class="my-6" />

    <!-- Repositories Section -->
    <n-flex vertical>
      <n-card
        v-for="repo in filteredRepos"
        :key="repo.repositoryId"
        class="bg-gray-50 shadow-md rounded-md p-4 hover:shadow-lg transition-all mb-2"
      >
        <div class="grid grid-cols-[3rem_auto_5px_40rem_150px] items-center gap-4">
          <!-- Repository Avatar -->
          <n-avatar
            size="medium"
            :src="`https://api.dicebear.com/9.x/identicon/svg?seed=${repo.repositoryId}&backgroundColor=ffffff&bacgroundType=gradientLinear`"
            class="w-12 h-12"
          />

          <!-- Repository Name and Link -->
          <div class="flex flex-col">
            <span
              class="text-gray-700 text-base"
            >
              {{ repo.repo }}
          </span>

            <NuxtLink
              :to="`https://github.com/${owner}/${repo.repo}`"
              target="_blank"
              class="text-sm text-gray-500 truncate transition-all hover:text-blue-600 hover:underline"
            >
              <Icon name="ri:external-link-line" size="12" />
              {{ owner }}/{{ repo.repo }}
            </NuxtLink>
          </div>

          <!-- Vertical Divider -->
          <div class="h-[70%] bg-gray-200 w-[1px]"></div>

          <!-- Commit Information -->
          <div class="flex flex-col max-w-[40rem]">
            <NuxtLink
              :to="repo?.latestCommitUrl"
              target="_blank"
              class="truncate text-base text-slate-600 transition-all hover:text-blue-600"
            >
              {{ repo?.latestCommitMessage }}
            </NuxtLink>
            <NuxtLink
              v-if="repo?.latestCommitSha"
              :to="repo?.latestCommitUrl"
              target="_blank"
              class="flex items-center gap-1 text-sm text-gray-400 transition-all hover:text-blue-600 hover:underline"
            >
              <Icon name="ri:git-commit-line" size="12" />
              {{ repo.latestCommitSha?.substring(0, 7) }}
            </NuxtLink>
          </div>

          <!-- Manage Button -->
          <div class="flex justify-end">
            <NuxtLink :to="`/dashboard/${owner}/${repo.repo}`">
              <n-button size="medium" type="primary" class="hover:shadow-md">
                <template #icon>
                  <Icon name="ri:settings-4-fill" />
                </template>
                Manage
              </n-button>
            </NuxtLink>
          </div>
        </div>
      </n-card>

      <!-- Empty State -->
      <n-empty
        v-if="filteredRepos.length === 0"
        class="mt-4"
        description="Codefair is not enabled on any repositories yet."
      />
    </n-flex>
  </n-flex>
</main>
</template>
