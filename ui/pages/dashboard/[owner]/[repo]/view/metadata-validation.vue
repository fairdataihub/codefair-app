<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

definePageMeta({
  middleware: ["protected"],
});

const route = useRoute();
const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.showBreadcrumbs();

const { owner, repo } = route.params as { owner: string; repo: string };

const { data, error } = await useFetch(`/api/${owner}/${repo}/metadata-validation`, {
  headers: useRequestHeaders(["cookie"]),
});

breadcrumbsStore.setFeature({
  id: "view-metadata-validation",
  name: "View metadata Validation",
  icon: "file-icons:codemeta",
});

if (error.value) {
  push.error({
    title: "Failed to fetch metadata validation details",
    message: "Please try again later",
  });

  throw createError(error.value);
}
</script>

<template>
  <main class="mx-auto max-w-screen-xl bg-white p-8">
    <n-flex vertical size="large" class="pb-5">
      <div class="flex flex-row justify-between">
        <h1 class="text-2xl font-bold">
          View Metadata Validation for
          <NuxtLink
            :to="`https://github.com/${owner}/${repo}`"
            target="_blank"
            class="text-blue-500 underline transition-all hover:text-blue-600"
          >
            {{ repo }}
          </NuxtLink>
        </h1>

        <NuxtLink
          to="https://docs.codefair.io/docs/metadata-validation.html"
          target="_blank"
          class="text-blue-400 underline transition-all hover:text-blue-500"
          >Need help?</NuxtLink
        >
      </div>

      <div class="border-b border-dashed py-2">
        <p class="text-base">
          Metadata validation is a process that ensures both CITATION.cff and codemeta.json files are valid against the Codefair validator.
          The validation process checks for the presence of required fields and values. If the validation fails, the validator will provide
          feedback on what needs to be fixed.
        </p>
      </div>

      <n-collapse :trigger-areas="['main', 'arrow']"></n-collapse>
    </n-flex>
    <pre>{{ data }}</pre>
  </main>
</template>
