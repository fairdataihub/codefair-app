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
</script>

<template>
  <main class="mx-auto max-w-screen-xl px-8 pb-8 pt-4">
    <n-flex vertical>
      <h1>Apps being managed by Codefair</h1>

      <n-divider />

      <n-flex vertical>
        <n-card
          v-for="repo in data"
          :key="repo.repositoryId"
          class="mt-2 rounded-lg shadow-md"
        >
          <n-flex align="center" justify="space-beteween">
            <n-flex align="center">
              <n-avatar
                size="small"
                :src="`https://api.dicebear.com/9.x/identicon/svg?seed=${repo.repositoryId}&backgroundColor=ffffff&bacgroundType=gradientLinear`"
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
                  {{ owner }}/{{ repo.repo }}
                </NuxtLink>
              </div>
            </n-flex>

            <div class="flex-1">
              <div class="flex flex-col gap-1">
                <NuxtLink
                  :to="repo?.latestCommitUrl"
                  target="_blank"
                  class="w-[350px] truncate text-left text-base font-medium transition-all hover:text-blue-500 hover:underline"
                >
                  {{ repo?.latestCommitMessage }}
                </NuxtLink>

                <NuxtLink
                  :to="repo?.latestCommitUrl"
                  target="_blank"
                  class="flex w-[350px] items-center gap-1 truncate text-left text-sm text-gray-500 transition-all hover:text-blue-500 hover:underline"
                >
                  <Icon name="ri:git-commit-line" size="17" />
                  {{ repo.latestCommitSha?.substring(0, 7) }}
                </NuxtLink>
              </div>
            </div>

            <n-flex align="center">
              <NuxtLink
                :to="`https://github.com/${owner}/${repo.repo}`"
                target="_blank"
                class="hidden"
              >
                <n-button secondary type="info">
                  <template #icon>
                    <Icon name="ri:github-fill" />
                  </template>
                  View on GitHub
                </n-button>
              </NuxtLink>

              <NuxtLink :to="`/dashboard/${owner}/${repo.repo}`">
                <n-button type="primary">
                  <template #icon>
                    <Icon name="ri:settings-4-fill" />
                  </template>

                  Manage FAIR Compliance
                </n-button>
              </NuxtLink>
            </n-flex>
          </n-flex>
        </n-card>
      </n-flex>
    </n-flex>

    <n-collapse class="mt-8" default-expanded-names="data">
      <n-collapse-item title="data" name="data">
        <pre>{{ data }}</pre>
      </n-collapse-item>
    </n-collapse>
  </main>
</template>
