<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.hideBreadcrumbs();

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
  <main class="h-full">
    <section class="mx-auto max-w-screen-xl px-8 pb-8 pt-4">
      <n-flex vertical>
        <!-- Header Section -->
        <div class="flex flex-row items-center justify-between">
          <h1 class="text-2xl font-bold">Dashboard</h1>

          <NuxtLink
            to="https://docs.codefair.io/docs/ui-dashboard.html"
            target="_blank"
            class="text-blue-500 underline transition-all hover:text-blue-600"
            >Need help?</NuxtLink
          >
        </div>

        <p class="text-base">
          These are the accounts and organizations that you have access to. You
          can manage the repositories and actions performed on them from here.
        </p>

        <LayoutSectionDivider class="my-4" />

        <!-- Your Account Section -->
        <h2 class="pb-4 text-xl font-semibold">Your Account</h2>

        <n-card class="rounded-lg bg-[var(--n-card-bg)] p-2 shadow-md">
          <div class="grid grid-cols-[20%_auto_200px] items-center gap-4">
            <div id="repo-avatar-and-name" class="flex items-center space-x-4">
              <!-- Adjusted Avatar Size -->
              <n-avatar
                :src="`https://api.dicebear.com/9.x/identicon/svg?seed=${data?.user.id}&backgroundColor=ffffff&bacgroundType=gradientLinear`"
                class="h-12 w-12"
              />

              <div class="flex flex-col">
                <span class="text-lg font-medium text-[var(--n-card-text)]">
                  {{ data?.user.username }}
                </span>

                <NuxtLink
                  :to="`https://github.com/${data?.user.username}`"
                  target="_blank"
                  class="truncate text-sm text-[var(--gray-500-300)] transition-all hover:text-[var(--link-hover)] hover:underline"
                >
                  <Icon name="ri:external-link-line" size="13" />
                  {{ data?.user.username }}
                </NuxtLink>
              </div>
            </div>

            <div></div>

            <div class="flex flex-col justify-end">
              <!-- Repo Count -->
              <div class="mb-2 flex flex-row justify-end whitespace-nowrap">
                <span class="text-sm text-[var(--gray-600-400)]"
                  >Codefair managed repositories:&nbsp;</span
                >

                <span class="text-sm text-[var(--n-card-text)]">{{
                  data?.user.repoCount || 0
                }}</span>
              </div>

              <NuxtLink
                class="flex justify-end"
                :to="`/dashboard/${data?.user.username}`"
              >
                <n-button type="primary" class="hover:shadow-lg">
                  <template #icon>
                    <Icon name="ri:settings-4-fill" />
                  </template>
                  Manage
                </n-button>
              </NuxtLink>
            </div>
          </div>
        </n-card>

        <LayoutSectionDivider class="my-6" />

        <!-- Your Organizations Section -->
        <h2 class="pb-4 text-xl font-semibold">Your Organizations</h2>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
          <n-card
            v-for="organization in data?.orgs"
            :key="organization.id"
            class="rounded-lg bg-white py-2 shadow-md"
          >
            <div class="flex items-start space-x-4">
              <!-- Organization Avatar -->
              <div class="h-14 w-14 flex-shrink-0">
                <n-avatar
                  :src="
                    organization.avatar
                      ? organization.avatar
                      : `https://api.dicebear.com/9.x/identicon/svg?seed=${organization.id}&backgroundColor=ffffff&bacgroundType=gradientLinear`
                  "
                  class="h-full w-full"
                />
              </div>

              <!-- Organization Name and Link -->
              <div class="flex flex-col">
                <span class="text-lg font-medium text-[var(--n-card-text)]">
                  {{ organization.name }}
                </span>

                <NuxtLink
                  :to="`https://github.com/${organization.name}`"
                  target="_blank"
                  class="truncate text-sm text-[var(--gray-500-300)] transition-all hover:text-[var(--link-hover)] hover:underline"
                >
                  <Icon name="ri:external-link-line" size="13" />
                  {{ organization.name }}
                </NuxtLink>
              </div>
            </div>

            <div class="mt-6 flex items-center justify-between">
              <!-- Repo Count -->
              <div class="flex items-center space-x-1">
                <span
                  class="whitespace-nowrap text-sm text-[var(--gray-600-400)]"
                >
                  Codefair managed repositories:
                </span>

                <span class="text-sm font-medium text-[var(--n-card-text)]">
                  {{ organization.repoCount }}
                </span>
              </div>

              <!-- Button -->
              <NuxtLink :to="`/dashboard/${organization.name}`">
                <n-button type="primary" class="hover:shadow-lg">
                  <template #icon>
                    <Icon name="ri:settings-4-fill" />
                  </template>
                  Manage
                </n-button>
              </NuxtLink>
            </div>
          </n-card>
        </div>
      </n-flex>
    </section>
  </main>
</template>
