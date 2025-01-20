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
      console.log("Redirect to view organization on github");
      navigateTo(`https://github.com/${owner}`, {open: {target: "_blank"}});
      break;
    case "view-codefair-settings":
      console.log("Navigate to Codefair settings");
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
      <div class="flex flex-row items-center justify-between">
        <h1>Apps being managed by Codefair</h1>

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

      <p class="mt-4 text-base">
        Some repositories may not appear here if they have not had any actions
        performed on their main branch yet. Once a couple of actions have been
        processed, the repositories will appear in the list.
      </p>

      <n-divider />

      <n-flex vertical>
        <n-card
          v-for="repo in filteredRepos"
          :key="repo.repositoryId"
          class="mt-2 rounded-lg shadow-md"
        >
          <div class="grid grid-cols-[20%_1px_auto_200px] items-center gap-4">
            <div id="repo-avatar-and-name" class="flex">
              <n-avatar
                size="small"
                :src="`https://api.dicebear.com/9.x/identicon/svg?seed=${repo.repositoryId}&backgroundColor=ffffff&bacgroundType=gradientLinear`"
                class="mr-4 mt-2"
              />

              <div class="flex flex-col">
                <NuxtLink
                  :to="`/dashboard/${owner}/${repo.repo}`"
                  target="_blank"
                  class="w-max transition-all hover:text-blue-500 hover:underline"
                >
                  <span class="text-lg font-medium">
                    {{ repo.repo }}
                  </span>
                </NuxtLink>

                <NuxtLink
                  :to="`https://github.com/${owner}/${repo.repo}`"
                  target="_blank"
                  class="w-max truncate text-left text-xs text-gray-500 transition-all hover:text-blue-500 hover:underline"
                >
                  <Icon name="ri:external-link-line" size="13" />
                  {{ owner }}/{{ repo.repo }}
                </NuxtLink>
              </div>
            </div>

            <n-divider vertical />

            <div id="repo-commits" class="truncate pl-4 pr-8">
              <div class="flex flex-col gap-0">
                <NuxtLink
                  :to="repo?.latestCommitUrl"
                  target="_blank"
                  class="truncate text-left text-base font-medium text-slate-500 transition-all hover:text-blue-500 hover:underline"
                >
                  {{ repo?.latestCommitMessage }}
                </NuxtLink>

                <NuxtLink
                  v-if="repo?.latestCommitSha"
                  :to="repo?.latestCommitUrl"
                  target="_blank"
                  class="flex items-center gap-1 truncate text-left text-sm text-gray-400 transition-all hover:text-blue-500 hover:underline"
                >
                  <Icon name="ri:git-commit-line" size="17" />
                  {{ repo.latestCommitSha?.substring(0, 7) }}
                </NuxtLink>
              </div>
            </div>

            <div class="flex justify-end">
              <NuxtLink :to="`/dashboard/${owner}/${repo.repo}`">
                <n-button type="primary">
                  <template #icon>
                    <Icon name="ri:settings-4-fill" />
                  </template>
                  Manage FAIR Compliance
                </n-button>
              </NuxtLink>
            </div>
          </div>
        </n-card>

        <n-empty
          v-if="filteredRepos.length === 0"
          description="Codefair is not enabled on any repositories yet."
        />
      </n-flex>
    </n-flex>
  </main>
</template>
