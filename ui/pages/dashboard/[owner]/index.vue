<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

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

const { data, error } = await useFetch(`/api/dashboard/${owner}`, {
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
  return data.value ? data.value.filter((repo) => repo.action_count === 0) : [];
});
</script>

<template>
  <main class="mx-auto max-w-screen-xl px-8 pb-8 pt-4">
    <n-flex vertical>
      <div class="flex flex-row justify-between">
        <h1>Apps being managed by Codefair</h1>

        <NuxtLink
          to="https://docs.codefair.io/docs/ui-dashboard.html"
          target="_blank"
          class="text-blue-400 underline transition-all hover:text-blue-500"
          >Need help?</NuxtLink
        >
      </div>

      <p class="text-base">
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
      </n-flex>
    </n-flex>

    <!-- <n-collapse class="mt-8" default-expanded-names="data">
      <n-collapse-item title="data" name="data">
        <pre>{{ data }}</pre>
      </n-collapse-item>
    </n-collapse> -->
  </main>
</template>
