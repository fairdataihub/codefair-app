<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

definePageMeta({
  middleware: ["protected"],
});

const user = useUser();
const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.hideBreadcrumbs();

const purgeTokens = async () => {
  await $fetch(`/api/user/tokens`, {
    headers: useRequestHeaders(["cookie"]),
    method: "DELETE",
  });

  push.success({
    title: "Success",
    message: "Your tokens has been purged.",
  });

  await $fetch("/api/logout", {
    method: "POST",
  });
  window.location.href = "/";
};
</script>

<template>
  <section class="mx-auto max-w-screen-xl p-4">
    <n-flex vertical>
      <h1>Profile</h1>

      <p>This is all the information we know about you.</p>
    </n-flex>

    <LayoutSectionDivider class="my-6" />

    <n-flex vertical size="large">
      <n-card title="GitHub Username" class="shadow-md">
        <NuxtLink :to="`https://github.com/${user?.username}`" target="_blank">
          <p>
            {{ user?.username }}
          </p>
        </NuxtLink>
      </n-card>

      <n-card title="GitHub ID" class="shadow-md">
        <p class="m-0">
          {{ user?.github_id }}
        </p>
      </n-card>

      <n-card title="Purge Tokens" class="shadow-md">
        <n-flex justify="space-between">
          <p class="">
            This will remove all Zenodo and GitHub tokens associated with your
            account.
          </p>

          <n-button type="error" @click="purgeTokens">
            <template #icon>
              <Icon name="fa:trash" size="16" />
            </template>
            Purge tokens
          </n-button>
        </n-flex>
      </n-card>
    </n-flex>
  </section>
</template>
