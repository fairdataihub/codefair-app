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
      <h1>Zenodo Settings</h1>

      <p>
        You can manage details about your Zenodo deposition here. This includes
        the title, description, and login details.
      </p>
    </n-flex>

    <div>hello</div>
  </main>
</template>
