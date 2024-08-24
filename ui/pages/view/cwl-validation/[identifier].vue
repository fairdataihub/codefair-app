<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

definePageMeta({
  middleware: ["protected"],
});

const route = useRoute();
const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.showBreadcrumbs();

const { identifier } = route.params as { identifier: string };

const githubRepo = ref<string | null>(null);

const { data, error } = await useFetch(`/api/cwlValidation/${identifier}`, {
  headers: useRequestHeaders(["cookie"]),
});

breadcrumbsStore.setFeature({
  id: "view-cwl-validation",
  name: "View CWL Validation",
  icon: "cib:common-workflow-language",
});

if (error.value) {
  push.error({
    title: "Failed to fetch license details",
    message: "Please try again later",
  });

  // console.error("Failed to fetch license details:", error.value);

  throw createError(error.value);
}

if (data.value) {
  githubRepo.value = `${data.value.owner}/${data.value.repo}`;

  breadcrumbsStore.setOwner(data.value.owner);
  breadcrumbsStore.setRepo(data.value.repo);
}
</script>

<template>
  <main class="mx-auto max-w-screen-xl bg-white p-8">
    <n-flex vertical size="large" class="pb-5">
      <div class="flex flex-row justify-between">
        <h1 class="text-2xl font-bold">
          View CWL Validation for
          <NuxtLink
            :to="`https://github.com/${githubRepo}`"
            target="_blank"
            class="text-blue-500 underline transition-all hover:text-blue-600"
          >
            {{ data?.repo }}
          </NuxtLink>
        </h1>

        <NuxtLink
          to="https://docs.codefair.io/docs/cwl-validation.html"
          target="_blank"
          class="text-blue-400 underline transition-all hover:text-blue-500"
          >Need help?</NuxtLink
        >
      </div>

      <div class="border-b border-dashed py-2">
        <p class="text-base">
          CWL is an open standard for describing how to run command line tools
          and connect them together in workflows. It is used by various workflow
          engines to execute scientific workflows. The CWL validation process
          ensures that the CWL file is correctly formatted and can be executed
          by a workflow engine. The validation process checks for syntax errors,
          missing required fields, and other issues that may prevent the
          workflow from running correctly. The following files were run through
          the CWL validation process:
        </p>
      </div>

      <n-collapse :trigger-areas="['main', 'arrow']">
        <n-collapse-item
          v-for="file in data?.files"
          :key="file.path"
          :title="file.path"
          :name="file.path"
        >
          <n-flex v-if="file.validation_status === 'invalid'" vertical>
            <n-alert type="error" :bordered="false">
              <pre
                >{{ file.validation_message }}
              </pre>
            </n-alert>
          </n-flex>

          <n-alert v-else type="success" :bordered="false">
            Workflow is valid
          </n-alert>

          <p class="pt-2 text-sm">
            This file was last validated on
            <time>{{
              $dayjs
                .unix(parseInt(file.last_validated.toString()) / 1000)
                .format("MMMM DD, YYYY [at] hh:mmA")
            }}</time>
          </p>

          <template #header-extra>
            <div class="flex items-center justify-end">
              <NuxtLink :to="file.href" target="_blank">
                <n-button type="success" size="small" secondary>
                  <template #icon>
                    <Icon name="eva:external-link-fill" size="16" />
                  </template>

                  View file
                </n-button>
              </NuxtLink>

              <div>
                <n-divider vertical />
              </div>

              <Icon
                :name="
                  file.validation_status === 'valid'
                    ? 'lets-icons:check-fill'
                    : 'lets-icons:alarm-fill'
                "
                :color="file.validation_status === 'valid' ? 'green' : 'orange'"
                size="30"
              />
            </div>
          </template>
        </n-collapse-item>
      </n-collapse>
    </n-flex>
  </main>
</template>
