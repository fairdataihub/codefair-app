<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";
import { Icon } from "#components";

const route = useRoute();

const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.showBreadcrumbs();
breadcrumbsStore.setFeature({
  id: "",
  name: "",
  icon: "",
});

const { owner, repo } = route.params as { owner: string; repo: string };

const devMode = process.env.NODE_ENV === "development";

const botNotInstalled = ref(false);
const cwlValidationRerunRequestLoading = ref(false);
const displayMetadataValidationResults = ref(false);
const showModal = ref(false);

const renderIcon = (icon: string) => {
  return () => {
    return h(Icon, { name: icon });
  };
};

const settingsOptions = [
  {
    icon: renderIcon("mdi:github"),
    key: "view-repo",
    label: "View repository",
  },
  {
    icon: renderIcon("mynaui:redo"),
    key: "rerun-codefair-on-repo",
    label: "Rerun all Codefair checks",
  },
  {
    icon: renderIcon("mdi:cog"),
    key: "view-codefair-settings",
    label: "View Codefair settings",
  },
];

const licenseSettingsOptions = [
  {
    icon: renderIcon("mdi:github"),
    key: "re-validate-license",
    label: "Re-validate license",
  },
];

const metadataSettingsOptions = [
  {
    icon: renderIcon("mdi:github"),
    key: "re-validate-metadata",
    label: "Re-validate metadata files",
  },
];

const { data, error } = await useFetch(`/api/${owner}/${repo}/dashboard`, {
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

if (
  (data.value?.codeMetadataRequest?.codemetaStatus === "invalid" ||
    data.value?.codeMetadataRequest?.citationStatus === "invalid") &&
  (data.value?.codeMetadataRequest?.containsCodemeta ||
    data.value?.codeMetadataRequest?.containsCitation)
) {
  displayMetadataValidationResults.value = true;
}

const hideConfirmation = () => {
  showModal.value = false;
};

const showConfirmation = () => {
  showModal.value = true;
};

const rerunCwlValidation = async () => {
  cwlValidationRerunRequestLoading.value = true;

  await $fetch(`/api/${owner}/${repo}/cwl-validation/rerun`, {
    headers: useRequestHeaders(["cookie"]),
    method: "POST",
  })
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

const rerunCodefairChecks = async (rerunType: string) => {
  hideConfirmation();
  push.info({
    title: "Submitting request",
    message:
      "Please wait while we submit a request to rerun the codefair checks on this repository.",
  });

  await $fetch(`/api/${owner}/${repo}/rerun`, {
    body: {
      rerunType,
    },
    headers: useRequestHeaders(["cookie"]),
    method: "POST",
  })
    .then(() => {
      push.success({
        title: "Success",
        message:
          "A request to rerun the codefair checks has been submitted succesfully. Please wait a few minutes for this process to take place.",
      });
    })
    .catch((error) => {
      if (error.statusMessage === "Validation already requested") {
        push.error({
          title: "Error",
          message:
            "A request to rerun the codefair checks has already been submitted. Please wait a few minutes for this process to take place.",
        });
      } else {
        push.error({
          title: "Error",
          message:
            "Failed to submit the request to rerun the codefair checks. Please try again later.",
        });
      }
    });
};

const handleSettingsSelect = (key: any) => {
  if (key === "view-repo") {
    navigateTo(`https://github.com/${owner}/${repo}`, {
      open: {
        target: "_blank",
      },
    });
  } else if (key === "rerun-codefair-on-repo") {
    rerunCodefairChecks("full-repo");
  } else if (key === "view-codefair-settings") {
    if (data.value?.isOrganization) {
      navigateTo(
        `https://github.com/organizations/${owner}/settings/installations/${data.value?.installationId}`,
        {
          open: {
            target: "_blank",
          },
        },
      );
    } else {
      navigateTo(
        `https://github.com/settings/installations/${data.value?.installationId}`,
        {
          open: {
            target: "_blank",
          },
        },
      );
    }
  } else if (key === "re-validate-license") {
    // rerunCodefairChecks("license");
    showConfirmation();
  } else if (key === "re-validate-metadata") {
    // rerunCodefairChecks("metadata");
    showConfirmation();
  }
};
</script>

<template>
  <main class="mx-auto max-w-screen-xl px-8 pb-8 pt-4">
    <n-flex vertical>
      <n-flex justify="space-between" align="start">
        <h1>FAIR Compliance Dashboard</h1>

        <n-dropdown
          :options="settingsOptions"
          placement="bottom-end"
          :show-arrow="true"
          @select="handleSettingsSelect"
        >
          <n-button type="info" secondary size="large">
            <template #icon>
              <Icon name="ic:round-settings" size="16" />
            </template>
            Settings</n-button
          >
        </n-dropdown>
      </n-flex>

      <p>
        This dashboard shows the compliance of the repository with the FAIR
        principles.
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

        <template #header-extra>
          <div
            v-if="data?.licenseRequest?.containsLicense"
            class="flex flex-wrap items-center space-x-2"
          >
            <n-tag
              v-if="data?.licenseRequest?.licenseStatus === 'valid'"
              type="success"
            >
              <template #icon>
                <Icon name="icon-park-solid:check-one" size="16" />
              </template>
              Contains a valid license
            </n-tag>

            <n-tooltip
              v-else-if="data?.licenseRequest?.licenseStatus === 'invalid'"
              trigger="hover"
            >
              <template #trigger>
                <n-tag type="warning">
                  <template #icon>
                    <Icon name="ic:round-warning" size="16" />
                  </template>
                  Might not contain a valid license
                </n-tag>
              </template>
              We couldn't determine if the license for this repository is valid.
            </n-tooltip>

            <n-tag
              v-if="data?.licenseRequest?.licenseId === 'Custom'"
              type="warning"
            >
              <template #icon>
                <Icon name="ic:round-warning" size="16" />
              </template>
              This repository uses a custom license.
            </n-tag>

            <!-- <n-button class="border-none"></n-button> -->

            <n-dropdown
              :options="licenseSettingsOptions"
              placement="bottom-end"
              :show-arrow="true"
              @select="handleSettingsSelect"
            >
              <n-button quaternary circle size="large">
                <template #icon>
                  <Icon name="humbleicons:dots-vertical" size="20" />
                </template>
              </n-button>
            </n-dropdown>

            <n-modal
              v-model:show="showModal"
              :mask-closable="false"
              preset="dialog"
              title="Are you sure?"
              content="Doing this action will overwrite any existing draft. Do you want to continue?"
              positive-text="Confirm"
              negative-text="Cancel"
              @positive-click="rerunCodefairChecks('license')"
              @negative-click="hideConfirmation"
            />
          </div>
        </template>

        <template #content>
          <p class="text-base">A License is required according to the FAIR-BioRS guidelines</p>
        </template>

        <template #action>
          <a :href="`/dashboard/${owner}/${repo}/edit/license`">
            <n-button type="primary">
              <template #icon>
                <Icon name="akar-icons:edit" size="16" />
              </template>
              Edit License
            </n-button>
          </a>
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

        <template #header-extra>
          <n-flex
            v-if="data?.licenseRequest?.containsLicense"
            class="items-center align-middle"
          >
            <n-popover trigger="hover">
              <template #trigger>
                <n-tag
                  v-if="data?.codeMetadataRequest?.containsCitation"
                  :type="
                    data?.codeMetadataRequest?.citationStatus === 'valid'
                      ? 'success'
                      : 'error'
                  "
                >
                  <template #icon>
                    <Icon
                      :name="
                        data?.codeMetadataRequest?.citationStatus === 'valid'
                          ? 'icon-park-solid:check-one'
                          : 'icon-park-solid:close-one'
                      "
                      size="16"
                    />
                  </template>
                  citation.CFF
                </n-tag>
              </template>

              <span v-if="data?.codeMetadataRequest?.citationStatus === 'valid'"
                >CITATION.cff is valid</span
              >

              <span v-else
                >Errors found in your file. View the report below</span
              >
            </n-popover>

            <n-popover trigger="hover">
              <template #trigger>
                <span>
                  <n-tag
                    v-if="data?.codeMetadataRequest?.containsCodemeta"
                    :type="
                      data?.codeMetadataRequest?.codemetaStatus === 'valid'
                        ? 'success'
                        : 'error'
                    "
                  >
                    <template #icon>
                      <Icon
                        :name="
                          data?.codeMetadataRequest?.codemetaStatus === 'valid'
                            ? 'icon-park-solid:check-one'
                            : 'icon-park-solid:close-one'
                        "
                        size="16"
                      />
                    </template>
                    codemeta.json
                  </n-tag>
                </span>
              </template>

              <span v-if="data?.codeMetadataRequest?.codemetaStatus === 'valid'"
                >codemeta.json is valid</span
              >

              <span v-else
                >Errors found in your file. View the report below</span
              >
            </n-popover>

            <n-dropdown
              v-if="data?.licenseRequest?.containsLicense"
              :options="metadataSettingsOptions"
              placement="bottom-end"
              :show-arrow="true"
              @select="handleSettingsSelect"
            >
              <n-button quaternary circle size="large">
                <template #icon>
                  <Icon name="humbleicons:dots-vertical" size="20" />
                </template>
              </n-button>
            </n-dropdown>

            <n-modal
              v-model:show="showModal"
              :mask-closable="false"
              preset="dialog"
              title="Are you sure?"
              content="Doing this action will overwrite any existing draft. Do you want to continue?"
              positive-text="Confirm"
              negative-text="Cancel"
              @positive-click="rerunCodefairChecks('metadata')"
              @negative-click="hideConfirmation"
            />
          </n-flex>
        </template>

        <template #content>
          <n-alert
            v-if="!data?.licenseRequest?.containsLicense"
            type="info"
            class="w-full"
          >
            There is no license in this repository. A license needs to be added
            to this repository before the code metadata can be validated.
          </n-alert>

          <div v-else>
            <p class="w-full text-base">
              The code metadata for the repository is shown here. This includes
              the number of files, the number of lines of code, and the number
              of commits.
            </p>
          </div>
        </template>

        <template #action>
          <div class="flex space-x-3">
            <a
              v-if="
                data?.codeMetadataRequest?.citationStatus === 'invalid' ||
                data?.codeMetadataRequest?.codemetaStatus === 'invalid'
              "
              :href="`/dashboard/${owner}/${repo}/view/metadata-validation`"
            >
              <n-button type="warning">
                <template #icon>
                  <Icon name="mdi:eye" size="16" />
                </template>
                Validation Results
              </n-button>
            </a>

            <a
              v-if="data?.licenseRequest?.containsLicense"
              :href="`/dashboard/${owner}/${repo}/edit/code-metadata`"
            >
              <n-button type="primary">
                <template #icon>
                  <Icon name="akar-icons:edit" size="16" />
                </template>
                Edit Code Metadata
              </n-button>
            </a>
          </div>
        </template>
      </CardDashboard>

      <n-divider />

      <h2 class="pb-6">Language Specific Standards</h2>

      <CardDashboard
        title="CWL Validation"
        subheader="Common Workflow Language (CWL) is an open standard for describing how to run command line tools and connect them to create workflows."
      >
        <template #icon>
          <Icon name="cib:common-workflow-language" size="40" />
        </template>

        <template #header-extra>
          <div v-if="data?.cwlValidation?.containsCWL">
            <n-tag
              v-if="data?.cwlValidation?.overallStatus === 'valid'"
              type="success"
            >
              <template #icon>
                <Icon name="icon-park-solid:check-one" size="16" />
              </template>
              Valid CWL file(s)
            </n-tag>

            <n-tag
              v-else-if="data?.cwlValidation?.overallStatus === 'invalid'"
              type="error"
            >
              <template #icon>
                <Icon name="icon-park-solid:close-one" size="16" />
              </template>
              Invalid CWL file(s)
            </n-tag>
          </div>
        </template>

        <template #content>
          <n-alert
            v-if="!data?.cwlValidation || !data.cwlValidation.containsCWL"
            type="info"
            class="w-full"
          >
            There are no CWL files in this repository.
          </n-alert>

          <p v-else class="text-base">
            Common Workflow Language (CWL) is an open standard for describing
            how to run command line tools and connect them to create workflows.
          </p>
        </template>

        <template #action>
          <div v-if="data?.cwlValidation?.containsCWL" class="flex space-x-3">
            <n-tooltip trigger="hover" placement="bottom-start">
              <template #trigger>
                <n-button
                  type="warning"
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

            <NuxtLink :to="`/dashboard/${owner}/${repo}/view/cwl-validation`">
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

      <h2 class="pb-6">FAIR Software Release</h2>

      <CardDashboard
        title="Make a FAIR Software Release"
        subheader="Make a GitHub release and archive the software on a software archival repository."
      >
        <template #icon>
          <Icon name="mingcute:rocket-fill" size="40" />
        </template>

        <template #header-extra>
          <n-flex>
            <NuxtLink
              v-if="data?.zenodoDeposition?.lastPublishedZenodoDoi"
              :to="`https://doi.org/${data?.zenodoDeposition?.lastPublishedZenodoDoi}`"
              target="_blank"
              class="cursor-pointer"
            >
              <n-tag type="success" class="cursor-pointer">
                <template #icon>
                  <Icon name="simple-icons:doi" size="16" />
                </template>
                {{ data?.zenodoDeposition?.lastPublishedZenodoDoi }}
              </n-tag>
            </NuxtLink>

            <div
              v-if="data?.licenseRequest?.containsLicense"
              class="flex flex-wrap space-x-2"
            >
              <n-tag
                v-if="data?.licenseRequest?.licenseId === 'Custom'"
                type="warning"
              >
                <template #icon>
                  <Icon name="ic:round-warning" size="16" />
                </template>
                Cannot publish to Zenodo with a custom license
              </n-tag>
            </div>

            <div v-if="data?.zenodoDeposition?.zenodoStatus">
              <n-tag
                v-if="data?.zenodoDeposition?.zenodoStatus === 'inProgress'"
                type="info"
              >
                <template #icon>
                  <Icon name="icon-park-solid:loading-three" size="16" />
                </template>
                Publish in progress
              </n-tag>

              <n-tag
                v-else-if="data?.zenodoDeposition?.zenodoStatus === 'error'"
                type="error"
              >
                <template #icon>
                  <Icon name="icon-park-solid:close-one" size="16" />
                </template>
                There was an error publishing to Zenodo
              </n-tag>
            </div>
          </n-flex>
        </template>

        <template #content>
          <div class="flex w-full flex-col space-y-2">
            <p class="text-base">
              To make your software FAIR, it is necessary to archive it in a
              software archival repository like Zenodo every time you make a
              release.
            </p>
          </div>
        </template>

        <template #action>
          <NuxtLink :to="`/dashboard/${owner}/${repo}/release/zenodo`">
            <n-button
              type="primary"
              :disabled="data?.licenseRequest?.licenseId === 'Custom'"
            >
              <template #icon>
                <Icon name="material-symbols:package-2" size="16" />
              </template>
              Create release
            </n-button>
          </NuxtLink>
        </template>
      </CardDashboard>
    </div>

    <n-collapse v-if="devMode" class="mt-8">
      <n-collapse-item title="data" name="data">
        <pre>{{ data }}</pre>
      </n-collapse-item>
    </n-collapse>
  </main>
</template>
