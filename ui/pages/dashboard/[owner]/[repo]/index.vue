<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";
import { Icon } from "#components";

const route = useRoute();
const { owner, repo } = route.params as { owner: string; repo: string };

const breadcrumbsStore = useBreadcrumbsStore();
breadcrumbsStore.showBreadcrumbs();
breadcrumbsStore.setFeature({ id: "", name: "", icon: "" });

const devMode = process.env.NODE_ENV === "development";
const botNotInstalled = ref(false);
const cwlValidationRerunRequestLoading = ref(false);
const displayMetadataValidationResults = ref(false);
const showModal = ref(false);
const showLicenseModal = ref(false);
const showMetadataModal = ref(false);
const showReadmeModal = ref(false);
const showCodeofConductModal = ref(false);
const showContributingModal = ref(false);
const loading = ref(false);

const renderIcon = (icon: string) => () => h(Icon, { name: icon });

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

const codeofConductSettingsOptions = [
  {
    icon: renderIcon("mdi:github"),
    key: "re-fetch-code-of-conduct",
    label: "Re-fetch Code of Conduct content",
  },
];

const contributingSettingsOptions = [
  {
    icon: renderIcon("mdi:github"),
    key: "re-fetch-contributing",
    label: "Re-fetch Contributing content",
  },
];

const readmeSettingsOptions = [
  {
    icon: renderIcon("mdi:github"),
    key: "re-fetch-readme",
    label: "Re-fetch README content",
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
        "Could not fetch dashboard data. Please try again later. Make sure Codefair has access to your account/organization.",
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

const hideConfirmation = () => (showModal.value = false);

const rerunCodefairChecks = async (rerunType: string) => {
  hideConfirmation();
  push.info({ title: "Submitting request", message: "Please wait..." });
  try {
    await $fetch(`/api/${owner}/${repo}/rerun`, {
      body: { rerunType },
      headers: useRequestHeaders(["cookie"]),
      method: "POST",
    });
    push.success({
      title: "Success",
      message: "Request submitted successfully.",
    });
  } catch (err: any) {
    push.error({
      title: "Error",
      message:
        err.statusMessage === "Validation already requested"
          ? "Request already submitted. Please wait."
          : "Failed to submit request. Try again later.",
    });
  }
};

const handlePositiveClick = async (reRunType: string) => {
  loading.value = true;
  await rerunCodefairChecks(reRunType);
  loading.value = false;
  showLicenseModal.value = false;
};

const rerunCwlValidation = async () => {
  cwlValidationRerunRequestLoading.value = true;
  try {
    await $fetch(`/api/${owner}/${repo}/cwl-validation/rerun`, {
      headers: useRequestHeaders(["cookie"]),
      method: "POST",
    });
    push.success({ title: "Success", message: "CWL revalidation requested." });
  } catch (err: any) {
    push.error({
      title: "Error",
      message:
        err.statusMessage === "Validation already requested"
          ? "Already requested. Please wait."
          : "Failed to submit CWL revalidation. Try again later.",
    });
  } finally {
    cwlValidationRerunRequestLoading.value = false;
  }
};

const handleSettingsSelect = (key: string) => {
  const actions: { [key: string]: () => void } = {
    "re-fetch-code-of-conduct": () => (showCodeofConductModal.value = true),
    "re-fetch-contributing": () => (showContributingModal.value = true),
    "re-fetch-readme": () => (showReadmeModal.value = true),
    "re-validate-license": () => (showLicenseModal.value = true),
    "re-validate-metadata": () => (showMetadataModal.value = true),
    "rerun-codefair-on-repo": () => rerunCodefairChecks("full-repo"),
    "view-codefair-settings": () => {
      const url = data.value?.isOrganization
        ? `https://github.com/organizations/${owner}/settings/installations/${data.value.installationId}`
        : `https://github.com/settings/installations/${data.value?.installationId}`;
      navigateTo(url, { open: { target: "_blank" } });
    },
    "view-repo": () =>
      navigateTo(`https://github.com/${owner}/${repo}`, {
        open: { target: "_blank" },
      }),
  };

  const action = actions[key];
  if (action) {
    action();
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
      The Codefair bot is not installed on this repository. Please install it to
      view the dashboard.
    </n-alert>

    <div v-else>
      <LayoutSectionDivider class="my-4" />

      <!-- License Card -->
      <CardDashboard
        title="License"
        subheader="The license for the repository is shown here."
      >
        <template #icon>
          <Icon name="tabler:license" size="40" />
        </template>

        <template #header-extra>
          <div class="flex flex-wrap items-center space-x-2">
            <div v-if="data?.licenseRequest?.containsLicense">
              <n-popover
                v-if="data?.licenseRequest?.licenseStatus === 'valid'"
                trigger="hover"
              >
                <template #trigger>
                  <n-tag type="success">
                    <template #icon>
                      <Icon name="icon-park-solid:check-one" size="16" />
                    </template>
                    Contains a valid license
                  </n-tag>
                </template>

                <span>SPDX License: {{ data?.licenseRequest?.licenseId }}</span>
              </n-popover>

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
                We couldn't determine if the license for this repository is
                valid.
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
            </div>

            <div v-else>
              <n-popover trigger="hover">
                <template #trigger>
                  <n-tag type="error">
                    <template #icon>
                      <Icon name="icon-park-solid:close-one" size="16" />
                    </template>
                    No license found
                  </n-tag>
                </template>

                <span>License file not found</span>
              </n-popover>
            </div>

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
              v-model:show="showLicenseModal"
              :mask-closable="false"
              preset="dialog"
              title="Are you sure?"
              content="Doing this action will overwrite any existing draft. Do you want to continue?"
              positive-text="Confirm"
              negative-text="Cancel"
              :loading="loading"
              @positive-click="handlePositiveClick('license')"
              @negative-click="showLicenseModal = false"
            />
          </div>
        </template>

        <template #content>
          <p class="text-base">
            A License is required according to the FAIR-BioRS guidelines.
          </p>
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

      <!-- README Card -->
      <CardDashboard
        title="README"
        subheader="The README for the repository is shown here."
      >
        <template #icon>
          <Icon name="gg:readme" size="40" />
        </template>

        <template #header-extra>
          <div class="flex flex-wrap items-center space-x-2">
            <div v-if="data?.readmeValidation?.readmeExists">
              <n-popover trigger="hover">
                <template #trigger>
                  <n-tag type="success">
                    <template #icon>
                      <Icon name="icon-park-solid:check-one" size="16" />
                    </template>

                    <span
                      >Repository contains a
                      {{ data?.readmeValidation?.readMePath }}</span
                    >
                  </n-tag>
                </template>

                <span
                  >{{ data?.readmeValidation?.readMePath }} file exists</span
                >
              </n-popover>
            </div>

            <div v-else>
              <n-popover trigger="hover">
                <template #trigger>
                  <n-tag type="error">
                    <template #icon>
                      <Icon name="icon-park-solid:close-one" size="16" />
                    </template>

                    <span>README file was not found.</span>
                  </n-tag>
                </template>

                <span>README not found</span>
              </n-popover>
            </div>

            <n-dropdown
              :options="readmeSettingsOptions"
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
              v-model:show="showReadmeModal"
              :mask-closable="false"
              preset="dialog"
              title="Are you sure?"
              content="This will overwrite any existing draft. Do you want to continue?"
              positive-text="Confirm"
              negative-text="Cancel"
              :loading="loading"
              @positive-click="handlePositiveClick('readme')"
              @negative-click="showReadmeModal = false"
            />
          </div>
        </template>

        <template #content>
          <p class="text-base">
            <span v-if="!data?.readmeValidation?.readmeExists"
              >A README file was not found at the root of your repository. This
              file is a markdown file that contains information about your
              project.</span
            >

            <span v-else
              >A {{ data?.readmeValidation?.readMePath }} was found.</span
            >
          </p>
        </template>

        <template #action>
          <a :href="`/dashboard/${owner}/${repo}/edit/readme`">
            <n-button type="primary">
              <template #icon>
                <Icon name="akar-icons:edit" size="16" />
              </template>
              Edit README
            </n-button>
          </a>
        </template>
      </CardDashboard>

      <n-divider />

      <!-- Code Metadata Card -->
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
            <!-- CITATION.CFF tag/popover -->
            <n-popover
              v-if="data?.codeMetadataRequest?.containsCitation"
              trigger="hover"
            >
              <template #trigger>
                <n-tag
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

              <template #default>
                <div class="text-center">
                  <span
                    v-if="data.codeMetadataRequest.citationStatus === 'valid'"
                  >
                    CITATION.cff is valid
                  </span>

                  <span v-else>
                    Errors found in your file. View the report below
                  </span>
                </div>
              </template>
            </n-popover>

            <!-- CODEMETA.JSON tag/popover -->
            <n-popover
              v-if="data?.codeMetadataRequest?.containsCodemeta"
              trigger="hover"
            >
              <template #trigger>
                <n-tag
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
              </template>

              <template #default>
                <div class="text-center">
                  <span
                    v-if="data?.codeMetadataRequest?.codemetaStatus === 'valid'"
                  >
                    codemeta.json is valid
                  </span>

                  <span v-else>
                    Errors found in your file. View the report below
                  </span>
                </div>
              </template>
            </n-popover>

            <n-dropdown
              v-if="data?.codeMetadataRequest?.containsCodemeta"
              :options="metadataSettingsOptions"
              placement="bottom-end"
              :show-arrow="true"
              @select="handleSettingsSelect"
            >
              <n-button quaternary circle size="large">
                <template #icon
                  ><Icon name="humbleicons:dots-vertical" size="20"
                /></template>
              </n-button>
            </n-dropdown>

            <n-modal
              v-model:show="showMetadataModal"
              :mask-closable="false"
              preset="dialog"
              title="Are you sure?"
              content="Doing this action will overwrite any existing draft. Do you want to continue?"
              positive-text="Confirm"
              negative-text="Cancel"
              :loading="loading"
              @positive-click="handlePositiveClick('metadata')"
              @negative-click="showMetadataModal = false"
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
            before metadata can be validated.
          </n-alert>

          <div v-else>
            <p class="w-full text-base">
              The code metadata for the repository is shown here. This includes
              the number of files, lines of code, and commits.
            </p>
          </div>
        </template>

        <template #action>
          <div class="flex space-x-3">
            <a
              v-if="
                data?.licenseRequest?.containsLicense &&
                (data?.codeMetadataRequest?.citationStatus === 'invalid' ||
                  data?.codeMetadataRequest?.codemetaStatus === 'invalid')
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

      <!-- FAIR Software Release Card -->
      <h2 class="pb-6">FAIR Software Release</h2>

      <CardDashboard
        title="Make a FAIR Software Release"
        subheader="Make a GitHub release and archive the software on a software archival repository."
      >
        <template #icon>
          <Icon name="mingcute:rocket-fill" size="40" />
        </template>

        <template #header-extra>
          <n-flex class="space-x-2">
            <n-popover
              v-if="data?.zenodoDeposition?.lastPublishedZenodoDoi"
              trigger="hover"
            >
              <template #trigger>
                <NuxtLink
                  :to="`https://doi.org/${data.zenodoDeposition.lastPublishedZenodoDoi}`"
                  target="_blank"
                  class="cursor-pointer"
                >
                  <n-tag type="success" class="cursor-pointer">
                    <template #icon
                      ><Icon name="simple-icons:doi" size="16"
                    /></template>
                    {{ data.zenodoDeposition.lastPublishedZenodoDoi }}
                    <Icon name="ri:external-link-line" size="13" />
                  </n-tag>
                </NuxtLink>
              </template>

              <template #default>
                <span>Last published Zenodo DOI</span>
              </template>
            </n-popover>

            <div
              v-if="
                data?.licenseRequest?.containsLicense &&
                data.licenseRequest.licenseId === 'Custom'
              "
              class="flex flex-wrap space-x-2"
            >
              <n-tag type="warning">
                <template #icon
                  ><Icon name="ic:round-warning" size="16"
                /></template>
                Cannot publish to Zenodo with a custom license
              </n-tag>
            </div>

            <div v-if="data?.zenodoDeposition?.zenodoStatus">
              <n-tag
                v-if="data?.zenodoDeposition?.zenodoStatus === 'inProgress'"
                type="info"
              >
                <template #icon
                  ><Icon name="icon-park-solid:loading-three" size="16"
                /></template>
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
              To make your software FAIR, archive it in a software archival
              repository like Zenodo every time you make a release.
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

      <n-divider />

      <!-- CWL Validation Card -->
      <h2 class="pb-6">Language Specific Standards</h2>

      <CardDashboard
        title="CWL Validation"
        subheader="Common Workflow Language (CWL) is an open standard for describing how to run command line tools and connect them into workflows."
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
            v-if="!data?.cwlValidation?.containsCWL"
            type="info"
            class="w-full"
          >
            There are no CWL files in this repository.
          </n-alert>

          <p v-else class="text-base">
            Common Workflow Language (CWL) is an open standard for describing
            how to run command line tools and connect them into workflows.
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

      <h2 class="pb-6">Additional Recommendations</h2>

      <!-- Code of Conduct card -->
      <CardDashboard
        title="Code of Conduct"
        subheader="The file serves as a guide for the community and helps to create a safe and inclusive environment for all contributors."
      >
        <template #icon>
          <Icon name="octicon:code-of-conduct-16" size="40" />
        </template>

        <template #header-extra>
          <div class="flex flex-wrap items-center space-x-2">
            <div v-if="data?.codeOfConductValidation?.codeExists">
              <n-popover trigger="hover">
                <template #trigger>
                  <n-tag type="success">
                    <template #icon>
                      <Icon name="icon-park-solid:check-one" size="16" />
                    </template>

                    <span
                      >Repository contains a
                      {{ data?.codeOfConductValidation?.codePath }}</span
                    >
                  </n-tag>
                </template>

                <span
                  >{{ data?.codeOfConductValidation?.codePath }} file
                  exists</span
                >
              </n-popover>
            </div>

            <div v-else>
              <n-popover trigger="hover">
                <template #trigger>
                  <n-tag type="error">
                    <template #icon>
                      <Icon name="icon-park-solid:close-one" size="16" />
                    </template>

                    <span>CODE_OF_CONDUCT.md not found.</span>
                  </n-tag>
                </template>

                <span
                  >CODE_OF_CONDUCT.md file was not in .github, docs, or the root
                  of your repository</span
                >
              </n-popover>
            </div>

            <n-dropdown
              :options="codeofConductSettingsOptions"
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
              v-model:show="showCodeofConductModal"
              :mask-closable="false"
              preset="dialog"
              title="Are you sure?"
              content="This will overwrite any existing draft. Do you want to continue?"
              positive-text="Confirm"
              negative-text="Cancel"
              :loading="loading"
              @positive-click="handlePositiveClick('readme')"
              @negative-click="showCodeofConductModal = false"
            />
          </div>
        </template>

        <template #content>
          <p class="text-base">
            <span v-if="!data?.codeOfConductValidation?.codeExists"
              >A CODE_OF_CONDUCT.md file was not found in .github, docs or the
              root of your repository.</span
            >

            <span v-else
              >A {{ data?.codeOfConductValidation?.codePath }} was found.</span
            >
          </p>
        </template>

        <template #action>
          <a :href="`/dashboard/${owner}/${repo}/edit/code-of-conduct`">
            <n-button type="primary">
              <template #icon>
                <Icon name="akar-icons:edit" size="16" />
              </template>
              Edit Code of Conduct
            </n-button>
          </a>
        </template>
      </CardDashboard>

      <n-divider />

      <!-- Contributing Card -->
      <CardDashboard
        title="Contributing"
        subheader="The file serves as a guide for the community and helps to create a safe and inclusive environment for all contributors."
      >
        <template #icon>
          <Icon name="catppuccin:contributing" size="40" />
        </template>

        <template #header-extra>
          <div class="flex flex-wrap items-center space-x-2">
            <div v-if="data?.contributingValidation?.contribExists">
              <n-popover trigger="hover">
                <template #trigger>
                  <n-tag type="success">
                    <template #icon>
                      <Icon name="icon-park-solid:check-one" size="16" />
                    </template>

                    <span
                      >Repository contains a
                      {{ data?.contributingValidation?.contribPath }}</span
                    >
                  </n-tag>
                </template>

                <span
                  >{{ data?.contributingValidation?.contribPath }} file
                  exists</span
                >
              </n-popover>
            </div>

            <div v-else>
              <n-popover trigger="hover">
                <template #trigger>
                  <n-tag type="error">
                    <template #icon>
                      <Icon name="icon-park-solid:close-one" size="16" />
                    </template>

                    <span>CONTRIBUTING.md not found.</span>
                  </n-tag>
                </template>

                <span
                  >CONTRIBUTING.md file was not in .github, docs, or the root of
                  your repository</span
                >
              </n-popover>
            </div>

            <n-dropdown
              :options="contributingSettingsOptions"
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
              v-model:show="showContributingModal"
              :mask-closable="false"
              preset="dialog"
              title="Are you sure?"
              content="This will overwrite any existing draft. Do you want to continue?"
              positive-text="Confirm"
              negative-text="Cancel"
              :loading="loading"
              @positive-click="handlePositiveClick('contributing')"
              @negative-click="showContributingModal = false"
            />
          </div>
        </template>

        <template #content>
          <p class="text-base">
            <span v-if="!data?.contributingValidation?.contribExists"
              >A CODE_OF_CONDUCT.md file was not found in .github, docs or the
              root of your repository.</span
            >

            <span v-else
              >A {{ data?.contributingValidation?.contribPath }} was
              found.</span
            >
          </p>
        </template>

        <template #action>
          <a :href="`/dashboard/${owner}/${repo}/edit/contributing`">
            <n-button type="primary">
              <template #icon>
                <Icon name="akar-icons:edit" size="16" />
              </template>
              Edit Contributing
            </n-button>
          </a>
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
