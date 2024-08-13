<script setup lang="ts">
const route = useRoute();

const { owner, repo } = route.params as { owner: string; repo: string };

const botNotInstalled = ref(false);
const cwlValidationRerunRequestLoading = ref(false);

const { data, error } = await useFetch(`/api/dashboard/${owner}/${repo}`, {
  headers: useRequestHeaders(["cookie"]),
});

if (error.value) {
  if (error.value.statusMessage === "installation-not-found") {
    // codefair bot is not installed on the repo.
    botNotInstalled.value = true;
  } else {
    push.error({
      title: "Something went wrong",
      message:
        "Could not fetch the data for the dashboard. Please try again later. Make sure the bot has access to your account/organization.",
    });

    throw createError(error.value);
  }
}

const rerunCwlValidation = async () => {
  cwlValidationRerunRequestLoading.value = true;

  await $fetch(
    `/api/cwlValidation/${data.value?.cwlValidation?.identifier}/rerun`,
    {
      headers: useRequestHeaders(["cookie"]),
      method: "POST",
    },
  )
    .then(() => {
      push.success({
        title: "Success",
        message:
          "A request to rerun the cwl validator has been submitted succesfully. Please wait a few minutes for this process to take place.",
      });
    })
    .catch((error) => {
      if (error.statusMessage === "Validation already requested") {
        push.error({
          title: "Error",
          message:
            "A request to rerun the cwl validator has already been submitted. Please wait a few minutes for this process to take place.",
        });
      } else {
        push.error({
          title: "Error",
          message:
            "Failed to submit the request to rerun the cwl validator. Please try again later.",
        });
      }
    })
    .finally(() => {
      cwlValidationRerunRequestLoading.value = false;
    });
};
</script>

<template>
  <main class="mx-auto max-w-screen-xl px-8 pb-8 pt-4">
    <n-breadcrumb class="pb-5">
      <n-breadcrumb-item :clickable="false">
        <Icon name="ri:dashboard-fill" />

        Dashboard
      </n-breadcrumb-item>

      <n-breadcrumb-item :clickable="false" :href="`/dashboard/${owner}`">
        <Icon name="uil:github" />
        {{ owner }}
      </n-breadcrumb-item>

      <n-breadcrumb-item>
        <Icon name="vscode-icons:folder-type-git" />
        {{ repo }}
      </n-breadcrumb-item>
    </n-breadcrumb>

    <n-flex vertical>
      <h1>FAIR-BioRS Compliance Dashboard</h1>

      <p>
        This dashboard shows the compliance of the repository with the
        FAIR-BioRS principles. Any actions that you need to take on the
        repository will be shown here.
      </p>
    </n-flex>

    <n-alert v-if="botNotInstalled" type="error" class="my-5">
      The Codefair bot is not installed on this repository. Please install the
      bot to view the compliance dashboard.
    </n-alert>

    <div v-else>
      <n-divider />

      <CardDashboard
        title="License"
        subheader="The license for the repository is shown here."
      >
        <template #icon>
          <Icon name="tabler:license" size="40" />
        </template>

        <template #content>
          <p>A License is required according to the FAIR-BioRS guidelines</p>
        </template>

        <template #action>
          <NuxtLink :to="`/add/license/${data?.licenseRequest?.identifier}`">
            <n-button type="primary">
              <template #icon>
                <Icon name="akar-icons:edit" size="16" />
              </template>
              Edit License
            </n-button>
          </NuxtLink>
        </template>
      </CardDashboard>

      <n-divider />

      <CardDashboard
        title="Code Metadata"
        subheader="The code metadata for the repository is shown here."
      >
        <template #icon>
          <Icon name="tabler:code" size="40" />
        </template>

        <template #content>
          <p>
            The code metadata for the repository is shown here. This includes
            the number of files, the number of lines of code, and the number of
            commits.
          </p>
        </template>

        <template #action>
          <NuxtLink
            :to="`/add/code-metadata/${data?.codeMetadataRequest?.identifier}`"
          >
            <n-button type="primary">
              <template #icon>
                <Icon name="akar-icons:edit" size="16" />
              </template>
              Edit Code Metadata
            </n-button>
          </NuxtLink>
        </template>
      </CardDashboard>

      <n-divider />

      <CardDashboard
        title="CWL Validation"
        subheader="Common Workflow Language (CWL) is an open standard for describing how to run command line tools and connect them to create workflows."
      >
        <template #icon>
          <Icon name="cib:common-workflow-language" size="40" />
        </template>

        <template #content>
          <n-alert
            v-if="!data?.cwlValidation || !data.cwlValidation.containsCWL"
            type="info"
            class="my-5"
          >
            There are no CWL files in this repository.
          </n-alert>

          <p v-else>
            Common Workflow Language (CWL) is an open standard for describing
            how to run command line tools and connect them to create workflows.
          </p>
        </template>

        <template #action>
          <div v-if="data?.cwlValidation?.containsCWL" class="flex space-x-3">
            <n-tooltip trigger="hover" placement="bottom-start">
              <template #trigger>
                <n-button
                  type="success"
                  secondary
                  :loading="cwlValidationRerunRequestLoading"
                  @click="rerunCwlValidation"
                >
                  <template #icon>
                    <Icon name="mynaui:redo" size="16" />
                  </template>

                  Rerun CWL Validation
                </n-button>
              </template>
              This may take a few minutes to complete.
            </n-tooltip>

            <NuxtLink
              :to="`/view/cwl-validation/${data?.cwlValidation?.identifier}`"
            >
              <n-button type="primary">
                <template #icon>
                  <Icon name="mdi:eye" size="16" />
                </template>
                View CWL Validation Results
              </n-button>
            </NuxtLink>
          </div>
        </template>
      </CardDashboard>

      <n-divider />
    </div>

    <!-- <n-collapse class="mt-8">
      <n-collapse-item title="data" name="data">
        <pre>{{ data }}</pre>
      </n-collapse-item>
    </n-collapse> -->
  </main>
</template>
