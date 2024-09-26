<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.showBreadcrumbs();
breadcrumbsStore.setFeature({
  id: "zenodo-settings",
  name: "Settings",
  icon: "mage:settings-fill",
});
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
  </main>
</template>
