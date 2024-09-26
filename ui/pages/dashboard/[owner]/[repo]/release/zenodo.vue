<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

const route = useRoute();
const user = useUser();
const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.showBreadcrumbs();
breadcrumbsStore.setFeature({
  id: "release-zenodo",
  name: "Zenodo",
  icon: "simple-icons:zenodo",
});

const { owner, repo } = route.params as { owner: string; repo: string };

const zenodoLoginUrl = ref("");

const { data, error } = await useFetch(`/api/${owner}/${repo}/release/zenodo`, {
  headers: useRequestHeaders(["cookie"]),
  method: "GET",
});

if (error.value) {
  push.error({
    title: "Failed to fetch release details",
    message: "Please try again later",
  });

  throw createError(error.value);
}

if (data.value) {
  console.log(data.value);
  zenodoLoginUrl.value = data.value.zenodoLoginUrl;
}
</script>

<template>
  <main class="mx-auto max-w-screen-xl px-8 pb-8 pt-4">
    <n-flex vertical>
      <h1>Zenodo Release</h1>

      <p>
        Create a release of your repository on Zenodo. We will also create a
        Github release and update all referencing DOIs to point to the Zenodo
        release.
      </p>
    </n-flex>

    <CardPlaceholder placeholder="Confirm license" />

    <CardPlaceholder placeholder="Confirm code metadata" />

    <n-divider />

    <h2 class="pb-6">Login to Zenodo</h2>

    <a :href="zenodoLoginUrl">
      <n-button type="primary">
        <template #icon>
          <Icon name="simple-icons:zenodo" size="16" />
        </template>
        Login to Zenodo
      </n-button>
    </a>

    <CardPlaceholder placeholder="Login to Zenodo" />

    <CardPlaceholder placeholder="Select Zenodo deposition or create new" />

    <CardPlaceholder placeholder="?Select Zenodo community?" />

    <CardPlaceholder placeholder="Add zenodo required metadata" />

    <CardPlaceholder
      placeholder="Create draft github release (add additional executables and update release notes)"
    />

    <CardPlaceholder placeholder="Confirm github release" />

    <CardPlaceholder placeholder="Publish Zenodo release" />
  </main>
</template>
