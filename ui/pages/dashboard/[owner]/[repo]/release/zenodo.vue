<script setup lang="ts">
import {
  type FormInst,
  type SelectOption,
  type SelectGroupOption,
  NTag,
} from "naive-ui";
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

definePageMeta({
  middleware: ["protected"],
});

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

const devMode = process.env.NODE_ENV === "development";

const zenodoLoginUrl = ref("");
const haveValidZenodoToken = ref(false);

const licenseChecked = ref(false);
const metadataChecked = ref(false);
const license = ref({
  id: "x",
  identifier: "x",
});
const metadataId = ref("");

const allConfirmed = computed(
  () => licenseChecked.value && metadataChecked.value,
);

const selectedExistingDeposition = ref<string | null>(null);
const selectedDeposition = ref<string | null>(null);
const selectableDepositions = ref<Array<SelectOption | SelectGroupOption>>([]);

const zenodoFormIsValid = ref(false);
const zenodoFormRef = ref<FormInst | null>(null);
const zenodoFormValue = ref<ZenodoMetadata>({
  accessRight: null,
  version: "",
});
const zenodoFormRules = ref({
  accessRight: {
    message: "Please select an access right",
    required: true,
    trigger: ["blur", "input"],
  },
  version: {
    message: "Please input a version",
    required: true,
    trigger: ["blur", "input"],
  },
});

const githubFormIsValid = ref(false);
const githubFormRef = ref<FormInst | null>(null);
const githubFormValue = ref<{
  release: string | null;
  releaseTitle: string;
  tag: string | null;
  tagTitle: string;
}>({
  release: null,
  releaseTitle: "",
  tag: null,
  tagTitle: "",
});
const githubFormRules = ref({
  release: {
    message: "Please select a release",
    required: true,
    trigger: ["blur", "change"],
  },
  tag: {
    message: "Please select a tag",
    required: true,
    trigger: ["blur", "change"],
  },
});

const githubTagOptions = ref<Array<SelectOption | SelectGroupOption>>([]);
const githubReleaseOptions = ref<Array<SelectOption | SelectGroupOption>>([]);

const lastSelectedUser = ref<string | null>(null);
const lastSelectedGithubTag = ref<string | null>(null);
const lastSelectedGithubRelease = ref<number | null>(null);
const lastSelectedGithubReleaseTitle = ref<string | null>(null);

const zenodoDraftIsReadyForRelease = ref(false);

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
  zenodoLoginUrl.value = data.value.zenodoLoginUrl;
  selectedDeposition.value = data.value.zenodoDepositionId?.toString() || null;
  haveValidZenodoToken.value = data.value.haveValidZenodoToken;

  license.value.id = data.value.license.id || "";
  license.value.identifier = data.value.license.identifier;
  metadataId.value = data.value.metadataId;

  selectedExistingDeposition.value = data.value.existingZenodoDepositionId
    ? "existing"
    : data.value.existingZenodoDepositionId === null
      ? null
      : "new";

  selectableDepositions.value = [];
  for (const deposition of data.value.zenodoDepositions) {
    selectableDepositions.value.push({
      label: deposition.title,
      value: deposition.id.toString(),
    });
  }

  zenodoFormValue.value.accessRight =
    data.value.zenodoMetadata.accessRight || null;
  zenodoFormValue.value.version = data.value.zenodoMetadata.version || "";

  lastSelectedUser.value = data.value.lastSelectedUser;
  lastSelectedGithubTag.value = data.value.lastSelectedGithubTag;
  lastSelectedGithubRelease.value = data.value.lastSelectedGithubRelease;
  lastSelectedGithubReleaseTitle.value =
    data.value.lastSelectedGithubReleaseTitle;

  githubTagOptions.value = [];
  githubReleaseOptions.value = [];

  for (const release of data.value.githubReleases) {
    githubTagOptions.value.push({
      disabled: !release.draft,
      label: release.tagName,
      value: release.tagName,
    });
    githubReleaseOptions.value.push({
      disabled: !release.draft,
      label: release.name || "Untitled release",
      prerelease: release.prerelease,
      value: release.id.toString(),
    });
  }

  // Remove duplicates in the githubTagOptions array
  githubTagOptions.value = githubTagOptions.value.filter(
    (option, index, self) =>
      index === self.findIndex((t) => t.value === option.value),
  );

  // Add 'new' option to the top of the list
  githubTagOptions.value.unshift({
    label: "I want to create a new tag",
    value: "new",
  });
  githubReleaseOptions.value.unshift({
    label: "I want to create a new release",
    value: "new",
  });

  // dev
  // githubFormValue.value.tag = `v${faker.system.semver()}`;
  // githubTagOptions.value.push({
  //   disabled: false,
  //   label: githubFormValue.value.tag || "",
  //   value: githubFormValue.value.tag,
  // });

  // githubFormValue.value.release = "new";
  // githubFormValue.value.title = faker.lorem.sentence();

  // slight hack but login step comes after the license and metadata checks
  if (haveValidZenodoToken.value) {
    licenseChecked.value = true;
    metadataChecked.value = true;
  }
}

const createDraftGithubReleaseSpinner = ref(false);

const createDraftGithubRelease = () => {
  githubFormRef.value?.validate(async (errors) => {
    if (!errors) {
      createDraftGithubReleaseSpinner.value = true;
      await $fetch(`/api/${owner}/${repo}/release/github`, {
        body: JSON.stringify({
          title: githubFormValue.value.releaseTitle,
          release: githubFormValue.value.release,
          tag:
            githubFormValue.value.tag === "new"
              ? githubFormValue.value.tagTitle
              : githubFormValue.value.tag,
        }),
        headers: useRequestHeaders(["cookie"]),
        method: "POST",
      })
        .then((response) => {
          push.success({
            title: "Success",
            message: "Your draft GitHub release has been created.",
          });

          // Add the releaseid to the options
          githubReleaseOptions.value.push({
            disabled: false,
            label: githubFormValue.value.releaseTitle,
            value: response.releaseId.toString(),
          });

          if (githubFormValue.value.tag === "new") {
            githubTagOptions.value.push({
              disabled: false,
              label: githubFormValue.value.tagTitle,
              value: githubFormValue.value.tagTitle,
            });
          }

          // Select the new release
          githubFormValue.value.release = response.releaseId.toString();

          const htmlUrl = response.htmlUrl;
          const editUrl = htmlUrl.replace("/tag/", "/edit/");

          window.open(editUrl, "_blank");
        })
        .catch((error) => {
          console.error("Failed to create draft GitHub release:", error);
          push.error({
            title: "Failed to create draft GitHub release",
            message: "Please try again later",
          });
        })
        .finally(() => {
          createDraftGithubReleaseSpinner.value = false;
        });
    } else {
      console.error("Form validation failed");
      console.error(errors);
    }
  });
};

const checkGithubReleaseSpinner = ref(false);
const githubReleaseIsDraft = ref(false);
const showGithubReleaseIsDraftStausBadge = ref(false);

const checkIfGithubReleaseIsDraft = async () => {
  const releaseId = githubFormValue.value.release;

  if (!releaseId) {
    showGithubReleaseIsDraftStausBadge.value = false;
    return null;
  }

  if (releaseId === "new") {
    showGithubReleaseIsDraftStausBadge.value = false;
    return null;
  }

  checkGithubReleaseSpinner.value = true;

  return await $fetch(`/api/${owner}/${repo}/release/github/${releaseId}`, {
    headers: useRequestHeaders(["cookie"]),
    method: "GET",
  })
    .then((response) => {
      if (response.draft) {
        githubReleaseIsDraft.value = true;
      } else {
        githubReleaseIsDraft.value = false;
      }
    })
    .catch((error) => {
      githubReleaseIsDraft.value = false;
      showGithubReleaseIsDraftStausBadge.value = false;

      console.error("Failed to fetch GitHub release:", error);
    })
    .finally(() => {
      showGithubReleaseIsDraftStausBadge.value = true;
      checkGithubReleaseSpinner.value = false;
    });
};

const handleGithubReleaseChange = () => {
  zenodoDraftIsReadyForRelease.value = false;
  githubFormValue.value.releaseTitle = "";
  checkIfGithubReleaseIsDraft();
};

const renderGithubReleaseLabel = (option: SelectOption): any => {
  return [
    option.prerelease &&
      h(
        NTag,
        {
          class: "mr-2",
          round: true,
          size: "small",
          type: "warning",
        },
        {
          default: () => "Prerelease",
        },
      ),
    // option.value === "new" &&
    //   h(
    //     NTag,
    //     {
    //       class: "mr-2",
    //       round: true,
    //       size: "small",
    //       type: "info",
    //     },
    //     {
    //       default: () => "New",
    //     },
    //   ),
    option.label as string,
  ];
};

const handleGithubTagChange = () => {
  zenodoDraftIsReadyForRelease.value = false;
  githubFormValue.value.tagTitle = "";
  checkIfGithubReleaseIsDraft();
};

const zenodoPublishSpinner = ref(false);
const zenodoDraftSpinner = ref(false);

const showZenodoPublishProgressModal = ref(false);
const zenodoPublishProgressInterval = ref<any>(null);
const zenodoPublishStatus = ref<string>("");
const zenodoPublishDOI = ref<string>("");

const checkForZenodoPublishProgress = () => {
  showZenodoPublishProgressModal.value = true;

  zenodoPublishProgressInterval.value = setInterval(async () => {
    await $fetch(`/api/${owner}/${repo}/release/zenodo/status`, {
      headers: useRequestHeaders(["cookie"]),
      method: "GET",
    })
      .then(async (response) => {
        if (response.zenodoWorkflowStatus !== "inProgress") {
          zenodoPublishStatus.value = response.zenodoWorkflowStatus;
          zenodoPublishDOI.value = response.zenodoDoi;

          clearInterval(zenodoPublishProgressInterval.value);

          await navigateTo(`/dashboard/${owner}/${repo}/`);
        }
      })
      .catch((error) => {
        console.error("Error checking Zenodo publish progress:", error);
      });
  }, 3000);
};

const startZenodoPublishProcess = async (shouldPublish: boolean = false) => {
  if (shouldPublish) {
    zenodoPublishSpinner.value = true;
  } else {
    zenodoDraftSpinner.value = true;
  }

  await $fetch(`/api/${owner}/${repo}/release/zenodo`, {
    body: JSON.stringify({
      metadata: zenodoFormValue.value,
      publish: shouldPublish,
      release: githubFormValue.value.release,
      tag:
        githubFormValue.value.tag !== "new"
          ? githubFormValue.value.tag
          : githubFormValue.value.tagTitle,
      useExistingDeposition: selectedExistingDeposition.value === "existing",
      zenodoDepositionId:
        selectedExistingDeposition.value === "existing"
          ? selectedDeposition.value?.toString()
          : "",
    }),
    headers: useRequestHeaders(["cookie"]),
    method: "POST",
  })
    .then((_response) => {
      if (githubFormValue.value.tag === "new") {
        githubTagOptions.value.push({
          disabled: false,
          label: githubFormValue.value.tagTitle,
          value: githubFormValue.value.tagTitle,
        });

        githubFormValue.value.tag = githubFormValue.value.tagTitle;
        githubFormValue.value.tagTitle = "";
      }

      if (shouldPublish) {
        push.success({
          title: "Success",
          message: "Your Zenodo publish process has been started.",
        });
        checkForZenodoPublishProgress();
      } else {
        push.success({
          title: "Success",
          message: "Your Zenodo draft has been saved.",
        });
      }
    })
    .catch((error) => {
      console.error("Failed to start Zenodo publish process:", error);
      push.error({
        title: "Failed to start Zenodo publish process",
        message: "Please try again later",
      });
    })
    .finally(() => {
      zenodoPublishSpinner.value = false;
      zenodoDraftSpinner.value = false;
    });
};

const validateZenodoForm = () => {
  zenodoFormRef.value?.validate((errors) => {
    if (!errors) {
      // Check if the selected zenodo deposition is an actual option'
      if (selectedExistingDeposition.value !== "new") {
        if (
          selectableDepositions.value.find(
            (item) => item.value === selectedDeposition.value?.toString(),
          )
        ) {
          // do nothing
        } else {
          zenodoFormIsValid.value = false;
          push.error({
            title: "Error",
            message: "Please select a valid Zenodo deposition.",
          });
          return;
        }
      }

      zenodoFormIsValid.value = true;

      push.success({
        title: "Success",
        message: "Your Zenodo metadata has been validated.",
      });
    } else {
      console.error("Form validation failed");
      console.error(errors);

      push.error({
        title: "Error",
        message: "Your Zenodo metadata could not be validated.",
      });

      zenodoFormIsValid.value = false;
    }
  });
};

const githubReleaseInterval = ref<any>(null);

onMounted(() => {
  // if there are items in the zenodoMetadata object, validate the zenodoForm
  if (
    data.value?.zenodoMetadata &&
    Object.keys(data.value.zenodoMetadata).length > 0
  ) {
    validateZenodoForm();
  }

  // check if the github release is a draft in a 1sec interval
  githubReleaseInterval.value = setInterval(async () => {
    await checkIfGithubReleaseIsDraft();
  }, 3000);
});

onBeforeUnmount(() => {
  clearInterval(githubReleaseInterval.value);
  clearInterval(zenodoPublishProgressInterval.value);
});
</script>

<template>
  <main class="mx-auto max-w-screen-xl px-8 pb-8 pt-4">
    <n-flex vertical>
      <h1>FAIR Software Release</h1>

      <p>
        Create a release of your repository on Zenodo. We will also create a
        Github release and update all referencing DOIs to point to the Zenodo
        release.
      </p>
    </n-flex>

    <n-divider />

    <n-flex vertical>
      <n-alert
        v-if="
          lastSelectedUser &&
          lastSelectedGithubTag &&
          lastSelectedGithubRelease &&
          data?.zenodoWorkflowStatus !== 'published'
        "
        :type="user?.username === lastSelectedUser ? 'info' : 'warning'"
        class="w-full"
      >
        A Zenodo release was last configured for this repository by
        <NuxtLink
          :to="`https://github.com/${lastSelectedUser}`"
          target="_blank"
          class="text-blue-500 underline transition-all hover:text-blue-700"
        >
          {{ lastSelectedUser }}</NuxtLink
        >
        The selected tag was
        <code>{{ lastSelectedGithubTag }}</code>

        and the selected release was titled
        <code>{{ lastSelectedGithubReleaseTitle || "Untitled" }}</code>

        <!-- <NuxtLink
          :to="`https://github.com/${owner}/${repo}/releases/${data?.lastSelectedGithubRelease}`"
          target="_blank"
          class="text-blue-500 underline transition-all hover:text-blue-700"
        >
          {{ data?.lastSelectedGithubRelease }}
        </NuxtLink> -->
        .
      </n-alert>

      <n-alert
        v-if="data?.lastPublishedZenodoDoi"
        type="success"
        class="w-full"
      >
        This repository was last released on Zenodo at
        <NuxtLink
          :to="`https://doi.org/${data?.lastPublishedZenodoDoi}`"
          target="_blank"
          class="text-blue-500 underline transition-all hover:text-blue-700"
          >{{ data?.lastPublishedZenodoDoi }}</NuxtLink
        >.
      </n-alert>

      <n-alert
        v-if="data?.lastPublishedZenodoDoi === 'inProgress'"
        type="info"
        class="w-full"
      >
        Zenodo is currently publishing this repository. You can check the status
        of the Zenodo deposition on the dashboard.
      </n-alert>

      <n-alert
        v-if="data?.lastPublishedZenodoDoi === 'error'"
        type="error"
        class="w-full"
      >
        There was an error with publishing this repository to Zenodo. Please try
        again later or contact the Codefair team for assistance.
      </n-alert>
    </n-flex>

    <h2 class="py-6">Required metadata files</h2>

    <n-flex vertical class="mb-4">
      <CardDashboard
        title="Confirm License"
        subheader="A license file is required for the repository to be released on Zenodo."
      >
        <template #icon>
          <Icon name="material-symbols:license" size="40" />
        </template>

        <template #content>
          <div class="flex w-full flex-col">
            <n-flex v-if="license.id" class="mb-4 border p-2" align="center">
              <Icon name="tabler:license" size="24" />

              <p class="text-sm">
                The license file was identified as `{{ license.id }}`
              </p>
            </n-flex>

            <n-checkbox v-model:checked="licenseChecked">
              I have added and reviewed the license file that is required for
              the repository to be released on Zenodo.
            </n-checkbox>
          </div>
        </template>

        <template #header-extra>
          <a :href="`/add/license/${license.identifier}`">
            <n-button type="primary">
              <template #icon>
                <Icon name="akar-icons:edit" size="16" />
              </template>
              Review license
            </n-button>
          </a>
        </template>
      </CardDashboard>

      <CardDashboard
        title="Confirm metadata"
        subheader="A code metadata file is required for the repository to be released on Zenodo."
      >
        <template #icon>
          <Icon name="tabler:code" size="40" />
        </template>

        <template #content>
          <div class="flex w-full flex-col space-y-4">
            <n-alert type="warning" class="w-full">
              Your <code> codemeta.json </code> file is used to generate the
              title, description, and metadata of your Zenodo deposition. Please
              make sure that the content of this file is correct and up-to-date.
            </n-alert>

            <n-checkbox v-model:checked="metadataChecked">
              I have added and reviewed the <code> citation.CFF </code>
              and
              <code> codemeta.json </code>
              files. I have verified that the content of these files are correct
              and up-to-date.
            </n-checkbox>
          </div>
        </template>

        <template #header-extra>
          <a :href="`/add/code-metadata/${metadataId}`">
            <n-button type="primary">
              <template #icon>
                <Icon name="akar-icons:edit" size="16" />
              </template>
              Review code metadata
            </n-button>
          </a>
        </template>
      </CardDashboard>
    </n-flex>

    <div v-if="allConfirmed">
      <n-divider />

      <h2 class="pb-6">Zenodo deposition</h2>

      <CardDashboard title="Check Zenodo connection">
        <template #icon>
          <Icon
            v-if="!haveValidZenodoToken"
            name="clarity:disconnect-line"
            size="40"
            class="text-red-500"
          />

          <Icon v-else name="wpf:connected" size="40" />
        </template>

        <template #content>
          <n-flex justify="space-between" class="w-full" align="center">
            <p v-if="haveValidZenodoToken">
              Looks like we have a valid Zenodo connection to your account. You
              can now continue to the next step.
            </p>

            <p v-else>
              There seems to be an issue with your Zenodo connection. Please
              login to Zenodo to continue.
            </p>

            <a v-if="!haveValidZenodoToken" :href="zenodoLoginUrl">
              <n-button type="primary">
                <template #icon>
                  <Icon name="simple-icons:zenodo" size="16" />
                </template>
                Login to Zenodo
              </n-button>
            </a>
          </n-flex>
        </template>
      </CardDashboard>

      <div v-if="haveValidZenodoToken">
        <n-divider />

        <CardDashboard title="Select your Zenodo record">
          <template #icon>
            <Icon name="tabler:file-text" size="40" />
          </template>

          <template #content>
            <div class="flex w-full flex-col">
              <h4 class="pb-2">
                Do you want to publish this repository to a new Zenodo
                deposition or to an existing one?
              </h4>

              <n-radio-group
                v-model:value="selectedExistingDeposition"
                name="selectedExistingDeposition"
                @update:value="selectedDeposition = null"
              >
                <n-radio-button
                  key="existing"
                  value="existing"
                  label="Existing Zenodo Deposition"
                />

                <n-radio-button
                  key="new"
                  value="new"
                  label="New Zenodo Deposition"
                />
              </n-radio-group>

              <div
                v-if="selectedExistingDeposition === 'existing'"
                class="mt-4"
              >
                <h4 class="pb-2">Select your Zenodo record</h4>

                <n-select
                  v-model:value="selectedDeposition"
                  size="large"
                  clearable
                  :options="selectableDepositions"
                />
              </div>
            </div>
          </template>
        </CardDashboard>

        <div v-if="selectedExistingDeposition === 'new' || selectedDeposition">
          <n-divider />

          <h2 class="pb-6">Zenodo metadata</h2>

          <CardDashboard title="Provide repository-specific metadata">
            <template #icon>
              <Icon name="material-symbols:add-notes-outline" size="40" />
            </template>

            <template #content>
              <div class="flex w-full flex-col space-y-4">
                <n-alert type="warning" class="w-full">
                  Your <code> codemeta.json </code> file is used to generate the
                  title, description, and metadata of your Zenodo deposition.
                  Please make sure that the content of this file is correct and
                  up-to-date. Provide below metadata required by Zenodo but not
                  available in codemeta.json.
                </n-alert>

                <n-form
                  ref="zenodoFormRef"
                  :label-width="80"
                  :model="zenodoFormValue"
                  :rules="zenodoFormRules"
                  size="large"
                >
                  <n-form-item
                    label="Version number for this release"
                    path="version"
                  >
                    <n-input
                      v-model:value="zenodoFormValue.version"
                      placeholder="1.0.0"
                    />
                  </n-form-item>

                  <n-form-item label="Access Right" path="accessRight">
                    <n-radio-group
                      v-model:value="zenodoFormValue.accessRight"
                      name="accessRight"
                    >
                      <n-flex vertical>
                        <n-radio value="open"> Open Access </n-radio>

                        <n-radio value="embargoed" disabled>
                          Embargoed Access
                        </n-radio>

                        <n-radio value="restricted" disabled>
                          Restricted Access
                        </n-radio>

                        <n-radio value="closed" disabled>
                          Closed Access
                        </n-radio>
                      </n-flex>
                    </n-radio-group>
                  </n-form-item>

                  <n-button @click="validateZenodoForm">
                    Confirm metadata
                  </n-button>
                </n-form>
              </div>
            </template>
          </CardDashboard>

          <div v-if="zenodoFormIsValid">
            <n-divider />

            <h2 class="pb-6">GitHub release</h2>

            <CardDashboard title="Draft a GitHub release">
              <template #icon>
                <Icon name="lucide:folder-git-2" size="40" />
              </template>

              <template #header-extra>
                <div v-if="showGithubReleaseIsDraftStausBadge">
                  <n-tag
                    v-if="githubReleaseIsDraft"
                    type="success"
                    size="small"
                  >
                    Github release is in draft state
                    <template #icon>
                      <Icon
                        v-if="checkGithubReleaseSpinner"
                        name="icon-park-twotone:loading-three"
                        size="16"
                      />

                      <Icon
                        v-else
                        name="icon-park-twotone:check-one"
                        size="16"
                      />
                    </template>
                  </n-tag>

                  <n-tag v-else type="error" size="small">
                    Github release is not in draft state
                    <template #icon>
                      <Icon
                        v-if="checkGithubReleaseSpinner"
                        name="icon-park-twotone:loading-three"
                        size="16"
                      />

                      <Icon v-else name="ic:round-warning" size="16" />
                    </template>
                  </n-tag>
                </div>
              </template>

              <template #content>
                <div class="flex w-full flex-col">
                  <n-form
                    ref="githubFormRef"
                    :label-width="80"
                    :model="githubFormValue"
                    :rules="githubFormRules"
                    size="large"
                  >
                    <n-form-item label="Github tag" path="tag">
                      <n-select
                        v-model:value="githubFormValue.tag"
                        :options="githubTagOptions"
                        tag
                        filterable
                        clearable
                        placeholder="Type or select a tag"
                        @update:value="handleGithubTagChange"
                      />
                    </n-form-item>

                    <n-form-item
                      v-show="githubFormValue.tag === 'new'"
                      label="Tag name"
                      path="tagTitle"
                      :rule="{
                        message: 'Please enter a tag name',
                        required: githubFormValue.tag === 'new',
                        trigger: ['blur', 'input'],
                      }"
                    >
                      <n-input
                        v-model:value="githubFormValue.tagTitle"
                        clearable
                        placeholder="v1.0.0"
                      />
                    </n-form-item>

                    <n-form-item label="Github release" path="release">
                      <n-select
                        v-model:value="githubFormValue.release"
                        :options="githubReleaseOptions"
                        placeholder="Select a release"
                        clearable
                        filterable
                        :loading="checkGithubReleaseSpinner"
                        :render-label="renderGithubReleaseLabel"
                        @update:value="handleGithubReleaseChange"
                      />
                    </n-form-item>

                    <n-form-item
                      v-show="githubFormValue.release === 'new'"
                      label="Release title"
                      path="releaseTitle"
                      :rule="{
                        message: 'Please enter a title',
                        required: githubFormValue.release === 'new',
                        trigger: ['blur', 'input'],
                      }"
                    >
                      <n-input
                        v-model:value="githubFormValue.releaseTitle"
                        clearable
                        placeholder="My awesome release title"
                      />
                    </n-form-item>

                    <div
                      v-if="
                        githubFormValue.release &&
                        githubFormValue.tag &&
                        githubFormValue.release !== 'new'
                      "
                      class="flex w-full flex-col space-y-4"
                    >
                      <n-alert type="info" class="w-full">
                        Please add any additional executables to your GitHub
                        release and also update the release notes. Once you are
                        done, you can come back to this page.
                      </n-alert>

                      <n-alert type="warning" class="w-full">
                        Do not publish your Github release yet. We will handle
                        this step for you.
                      </n-alert>

                      <n-button
                        v-if="!zenodoDraftIsReadyForRelease"
                        secondary
                        type="primary"
                        @click="zenodoDraftIsReadyForRelease = true"
                      >
                        <template #icon>
                          <Icon name="basil:play-solid" size="16" />
                        </template>

                        My draft is ready for release
                      </n-button>
                    </div>

                    <div
                      v-if="
                        githubFormValue.release === 'new' &&
                        githubFormValue.releaseTitle !== ''
                      "
                      class="flex w-full flex-col space-y-4"
                    >
                      <n-alert type="info" class="w-full">
                        Your GitHub release will be created in a draft state.
                        Please make sure to add any additional executables and
                        update the release notes. Once you are done, you can
                        come back to this page.
                      </n-alert>

                      <n-alert type="warning" class="w-full">
                        Do not publish your Github release yet. We will handle
                        this step for you.
                      </n-alert>

                      <n-button
                        :loading="createDraftGithubReleaseSpinner"
                        secondary
                        type="primary"
                        @click="createDraftGithubRelease"
                      >
                        <template #icon>
                          <Icon name="fa:plus" size="16" />
                        </template>
                        Create draft GitHub release
                      </n-button>
                    </div>
                  </n-form>
                </div>
              </template>
            </CardDashboard>
          </div>

          <div
            v-if="
              (githubFormIsValid || githubReleaseIsDraft) &&
              zenodoDraftIsReadyForRelease
            "
          >
            <n-divider />

            <h2 class="pb-6">Zenodo release</h2>

            <CardDashboard title="Publish release on Zenodo">
              <template #icon>
                <Icon name="simple-icons:zenodo" size="40" />
              </template>

              <template #content>
                <div class="flex w-full flex-col space-y-4">
                  <p>
                    You may save the current configuration as a draft and come
                    back to it later.
                  </p>

                  <n-flex justify="space-between">
                    <n-button
                      :loading="zenodoDraftSpinner"
                      secondary
                      type="primary"
                      @click="startZenodoPublishProcess(false)"
                    >
                      <template #icon>
                        <Icon name="fa:save" size="16" />
                      </template>

                      Save draft
                    </n-button>

                    <n-button
                      :loading="zenodoPublishSpinner"
                      type="primary"
                      color="black"
                      @click="startZenodoPublishProcess(true)"
                    >
                      <template #icon>
                        <Icon
                          name="material-symbols-light:play-circle"
                          size="16"
                        />
                      </template>

                      Start the Zenodo publish process
                    </n-button>
                  </n-flex>
                </div>
              </template>
            </CardDashboard>
          </div>
        </div>
      </div>
    </div>

    <n-alert v-else type="warning" class="w-full">
      You have not yet confirmed the required metadata files. Please review the
      license and code metadata files above to continue.
    </n-alert>

    <n-collapse v-if="devMode" class="mt-8" :default-expanded-names="[]">
      <n-collapse-item title="data" name="data">
        <pre>{{ data }}</pre>
      </n-collapse-item>
    </n-collapse>

    <n-modal
      v-model:show="showZenodoPublishProgressModal"
      preset="card"
      :title="
        zenodoPublishStatus === 'inProgress'
          ? 'Zenodo publish in progress'
          : 'Zenodo publish completed'
      "
      :bordered="false"
      size="huge"
      :mask-closable="false"
      :close-on-esc="false"
      style="width: 600px"
    >
      <n-flex v-if="zenodoPublishStatus === 'inProgress'" vertical>
        <p>
          The workflow for publishing this repository to Zenodo is currently in
          progress. You can check the status of this workflow on the dashboard
        </p>

        <n-spin size="large" />
      </n-flex>

      <n-flex v-else-if="zenodoPublishStatus === 'error'" vertical>
        <p>
          There was an error with publishing this repository to Zenodo. Please
          try again later or contact the Codefair team for assistance.
        </p>
      </n-flex>

      <n-flex v-else-if="zenodoPublishStatus === 'published'" vertical>
        <p>
          Your Zenodo deposition has been published. You can view the Zenodo
          record on the dashboard.
        </p>

        <NuxtLink :to="`https://doi.org/${zenodoPublishDOI}`" target="_blank">
          <n-button type="primary">
            <template #icon>
              <Icon name="simple-icons:zenodo" size="16" />
            </template>
            View Zenodo record
          </n-button>
        </NuxtLink>
      </n-flex>

      <template #footer>
        <n-flex justify="end">
          <n-button
            type="success"
            @click="showZenodoPublishProgressModal = false"
          >
            Okay
          </n-button>
        </n-flex>
      </template>
    </n-modal>
  </main>
</template>
