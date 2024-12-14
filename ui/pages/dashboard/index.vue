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

const { data, error } = await useFetch(`/api/dashboard`, {
  headers: useRequestHeaders(["cookie"]),
});

if (error.value) {
  console.error(error.value);

  push.error({
    title: "Something went wrong",
    message:
      "Could not fetch the data for the dashboard. Please try again later.",
  });

  throw createError(error.value);
}
</script>

<template>
  <main class="mx-auto max-w-screen-xl px-8 pb-8 pt-4">
    <n-flex vertical>
      <div class="flex flex-row justify-between">
        <h1>Your dashboard</h1>

        <NuxtLink
          to="https://docs.codefair.io/docs/ui-dashboard.html"
          target="_blank"
          class="text-blue-400 underline transition-all hover:text-blue-500"
          >Need help?</NuxtLink
        >
      </div>

      <p class="text-base">
        These are the accounts and organization that you have access to. You can
        manage the repositories and actions performed on them from here.
      </p>

      <n-divider />

      <h2 class="pb-6">Your Account</h2>

      <n-card class="mt-2 rounded-lg shadow-md">
        <div class="grid grid-cols-[20%_1px_auto_200px] items-center gap-4">
          <div id="repo-avatar-and-name" class="flex">
            <n-avatar
              size="small"
              :src="`https://api.dicebear.com/9.x/identicon/svg?seed=${data?.user.id}&backgroundColor=ffffff&bacgroundType=gradientLinear`"
              class="mr-4 mt-2"
            />

            <div class="flex flex-col">
              <NuxtLink
                :to="`/dashboard/${data?.user.username}`"
                target="_blank"
                class="w-max transition-all hover:text-blue-500 hover:underline"
              >
                <span class="text-lg font-medium">
                  {{ data?.user.username }}
                </span>
              </NuxtLink>

              <NuxtLink
                :to="`https://github.com/${data?.user.username}`"
                target="_blank"
                class="w-max truncate text-left text-xs text-gray-500 transition-all hover:text-blue-500 hover:underline"
              >
                <Icon name="ri:external-link-line" size="13" />
                {{ data?.user.username }}
              </NuxtLink>
            </div>
          </div>

          <n-divider vertical />

          <div></div>

          <div class="flex justify-end">
            <NuxtLink :to="`/dashboard/${data?.user.username}`">
              <n-button type="primary">
                <template #icon>
                  <Icon name="ri:settings-4-fill" />
                </template>
                View Codefair enabled repositories
              </n-button>
            </NuxtLink>
          </div>
        </div>
      </n-card>

      <n-divider />

      <h2 class="pb-6">Your Organizations</h2>

      <n-flex vertical>
        <n-card
          v-for="organization in data?.orgs"
          :key="organization.id"
          class="mt-2 rounded-lg shadow-md"
        >
          <div class="grid grid-cols-[20%_1px_auto_200px] items-center gap-4">
            <div id="repo-avatar-and-name" class="flex">
              <n-avatar
                size="large"
                :src="
                  organization.avatar
                    ? organization.avatar
                    : `https://api.dicebear.com/9.x/identicon/svg?seed=${organization.id}&backgroundColor=ffffff&bacgroundType=gradientLinear`
                "
                class="mr-4 mt-2"
              />

              <div class="flex flex-col">
                <NuxtLink
                  :to="`/dashboard/${organization.name}`"
                  target="_blank"
                  class="w-max transition-all hover:text-blue-500 hover:underline"
                >
                  <span class="text-lg font-medium">
                    {{ organization.name }}
                  </span>
                </NuxtLink>

                <NuxtLink
                  :to="`https://github.com/${organization.name}`"
                  target="_blank"
                  class="w-max truncate text-left text-xs text-gray-500 transition-all hover:text-blue-500 hover:underline"
                >
                  <Icon name="ri:external-link-line" size="13" />
                  {{ organization.name }}
                </NuxtLink>
              </div>
            </div>

            <n-divider vertical />

            <div></div>

            <!-- <div id="repo-commits" class="truncate pl-4 pr-8">
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
            </div> -->

            <div class="flex justify-end">
              <NuxtLink :to="`/dashboard/${organization.name}`">
                <n-button type="primary">
                  <template #icon>
                    <Icon name="ri:settings-4-fill" />
                  </template>
                  View Codefair enabled repositories
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
