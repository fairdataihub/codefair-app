<script setup lang="ts">
import type { FormInst, SelectOption, SelectGroupOption } from "naive-ui";
import { faker } from "@faker-js/faker";
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

const devMode = process.env.NODE_ENV === "development";

const zenodoLoginUrl = ref("");
const haveValidZenodoToken = ref(false);

const licenseChecked = ref(true);
const metadataChecked = ref(true);
const licenseId = ref("");
const metadataId = ref("");

const allConfirmed = computed(
  () => licenseChecked.value && metadataChecked.value,
);

const selectedExistingDeposition = ref<String | null>(null);
const selectedDeposition = ref<String | null>(null);
const selectableDepositions = ref<Array<SelectOption | SelectGroupOption>>([]);

const zenodoFormRef = ref<FormInst | null>(null);
const zenodoFormValue = ref<ZenodoMetadata>({
  accessRight: null,
});
const zenodoFormRules = ref({
  accessRight: {
    message: "Please select an access right",
    required: true,
    trigger: ["blur", "input"],
  },
});

const githubFormRef = ref<FormInst | null>(null);
const githubFormValue = ref({
  title: "",
  release: null,
  tag: null,
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
  selectedDeposition.value = data.value.zenodoDepositionId || null;
  haveValidZenodoToken.value = data.value.haveValidZenodoToken;
  licenseId.value = data.value.licenseId;
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
      value: deposition.id,
    });
  }

  zenodoFormValue.value.accessRight =
    data.value.zenodoMetadata.accessRight || null;

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
      value: release.id.toString(),
    });
  }

  // Add 'new' option to the top of the list
  githubReleaseOptions.value.unshift({
    label: "new",
    value: "new",
  });

  // dev
  githubFormValue.value.tag = `v${faker.system.semver()}`;
  githubTagOptions.value.push({
    disabled: false,
    label: githubFormValue.value.tag,
    value: githubFormValue.value.tag,
  });

  githubFormValue.value.release = "new";
  githubFormValue.value.title = faker.lorem.sentence();
}

const handleChange = (e: Event) => {
  selectedExistingDeposition.value = (e.target as HTMLInputElement).value;
};

const validateZenodoForm = () => {
  zenodoFormRef.value?.validate(async (errors) => {
    if (!errors) {
      console.log("Form validated successfully");
    } else {
      console.log("Form validation failed");
      console.log(errors);
    }
  });
};

const createDraftGithubReleaseSpinner = ref(false);

const createDraftGithubRelease = async () => {
  githubFormRef.value?.validate(async (errors) => {
    if (!errors) {
      createDraftGithubReleaseSpinner.value = true;
      await $fetch(`/api/${owner}/${repo}/release/github`, {
        body: JSON.stringify({
          title: githubFormValue.value.title,
          release: githubFormValue.value.release,
          tag: githubFormValue.value.tag,
        }),
        headers: useRequestHeaders(["cookie"]),
        method: "POST",
      })
        .then(async (response) => {
          console.log(response);
          push.success({
            title: "Success",
            message: "Your draft GitHub release has been created.",
          });

          // Add the releaseid to the options
          githubReleaseOptions.value.push({
            disabled: false,
            label: githubFormValue.value.title,
            value: response.releaseId.toString(),
          });

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

const zenodoPublishSpinner = ref(false);
const zenodoDraftSpinner = ref(false);

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
      tag: githubFormValue.value.tag,
      useExistingDeposition: selectedExistingDeposition.value === "existing",
      zenodoDepositionId:
        selectedExistingDeposition.value === "existing"
          ? selectedDeposition.value?.toString()
          : "",
    }),
    headers: useRequestHeaders(["cookie"]),
    method: "POST",
  })
    .then(async (response) => {
      if (shouldPublish) {
        push.success({
          title: "Success",
          message: "Your Zenodo publish process has been started.",
        });
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

    <n-divider />

    <h2 class="pb-6">Confirm required metadata files</h2>

    <n-flex vertical class="mb-4">
      <CardDashboard
        title="License"
        subheader="A license file is required for the repository to be released on Zenodo."
      >
        <template #icon>
          <Icon name="material-symbols:license" size="40" />
        </template>

        <template #content>
          <n-checkbox v-model:checked="licenseChecked">
            I have added and reviewed the license file that is required for the
            repository to be released on Zenodo.
          </n-checkbox>
        </template>

        <template #header-extra>
          <a :href="`/add/license/${licenseId}`">
            <n-button type="primary">
              <template #icon>
                <Icon name="akar-icons:edit" size="16" />
              </template>
              Review License
            </n-button>
          </a>
        </template>
      </CardDashboard>

      <CardDashboard
        title="Code Metadata"
        subheader="A code metadata file is required for the repository to be released on Zenodo."
      >
        <template #icon>
          <Icon name="tabler:code" size="40" />
        </template>

        <template #content>
          <n-checkbox v-model:checked="metadataChecked">
            I have added and reviewed the <code> citation.CFF </code>

            and <code> codemeta.json </code>
            files. I have verified that the content of these files are correct
            and up-to-date.
          </n-checkbox>
        </template>

        <template #header-extra>
          <a :href="`/add/code-metadata/${metadataId}`">
            <n-button type="primary">
              <template #icon>
                <Icon name="akar-icons:edit" size="16" />
              </template>
              Review Code Metadata
            </n-button>
          </a>
        </template>
      </CardDashboard>
    </n-flex>

    <div v-if="allConfirmed">
      <n-divider />

      <h2 class="pb-6">Select Zenodo deposition</h2>

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

      <n-divider />

      <CardDashboard title="Select your Zenodo record">
        <template #icon>
          <Icon name="tabler:file-text" size="40" />
        </template>

        <template #content>
          <div class="flex w-full flex-col">
            <h4 class="pb-2">
              Do you want to publish this repository to a new Zenodo deposition
              or to an existing one?
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

            <div class="mt-4" v-if="selectedExistingDeposition === 'existing'">
              <h4 class="pb-2">Select your Zenodo record</h4>

              <n-select
                v-model:value="selectedDeposition"
                size="large"
                :options="selectableDepositions"
              />
            </div>
          </div>
        </template>
      </CardDashboard>

      <n-divider />

      <h2 class="pb-6">Zenodo metadata</h2>

      <CardDashboard title="Add missing metadata">
        <template #icon>
          <Icon name="material-symbols:add-notes-outline" size="40" />
        </template>

        <template #content>
          <div class="flex w-full flex-col">
            <n-form
              ref="zenodoFormRef"
              :label-width="80"
              :model="zenodoFormValue"
              :rules="zenodoFormRules"
              size="large"
            >
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

                    <n-radio value="closed" disabled> Closed Access </n-radio>
                  </n-flex>
                </n-radio-group>
              </n-form-item>

              <n-button @click="validateZenodoForm"> Continue </n-button>
            </n-form>
          </div>
        </template>
      </CardDashboard>

      <n-divider />

      <h2 class="pb-6">GitHub release</h2>

      <CardDashboard title="Draft a GitHub release">
        <template #icon>
          <Icon name="lucide:folder-git-2" size="40" />
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
              <n-form-item label="Github Tag" path="tag">
                <n-select
                  v-model:value="githubFormValue.tag"
                  :options="githubTagOptions"
                  tag
                  filterable
                  clearable
                  placeholder="Select a tag"
                />
              </n-form-item>

              <n-form-item label="Github Release" path="release">
                <n-select
                  v-model:value="githubFormValue.release"
                  :options="githubReleaseOptions"
                  placeholder="Select a release"
                  clearable
                  filterable
                />
              </n-form-item>

              <n-form-item
                v-show="githubFormValue.release === 'new'"
                label="Release Title"
                path="title"
                :rule="{
                  message: 'Please enter a title',
                  required: githubFormValue.release === 'new',
                  trigger: ['blur', 'input'],
                }"
              >
                <n-input
                  v-model:value="githubFormValue.title"
                  clearable
                  placeholder="Enter release title"
                />
              </n-form-item>

              <p>
                Your github release will be created in a draft state. Please
                make sure to add any additional executables and update the
                release notes. Once you are done, you can come back to this page
                and publish the release.
              </p>

              <n-button
                :loading="createDraftGithubReleaseSpinner"
                @click="createDraftGithubRelease"
              >
                <template #icon>
                  <Icon name="fa:plus" size="16" />
                </template>
                Create draft GitHub release
              </n-button>
            </n-form>
          </div>
        </template>
      </CardDashboard>

      <n-divider />

      <h2 class="pb-6">Publish Zenodo release</h2>

      <CardDashboard title="Publish Zenodo release">
        <template #icon>
          <Icon name="simple-icons:zenodo" size="40" />
        </template>

        <template #content>
          <div class="flex w-full flex-col">
            <n-flex>
              <n-button
                :loading="zenodoDraftSpinner"
                @click="startZenodoPublishProcess(false)"
              >
                <template #icon>
                  <Icon name="fa:save" size="16" />
                </template>

                Save draft
              </n-button>

              <n-button
                :loading="zenodoPublishSpinner"
                @click="startZenodoPublishProcess(true)"
              >
                <template #icon>
                  <Icon name="raphael:start" size="16" />
                </template>

                Start Zenodo publish process
              </n-button>
            </n-flex>
          </div>
        </template>
      </CardDashboard>
    </div>

    <n-alert v-else type="warning" class="w-full">
      You have not yet confirmed the required metadata files. Please review the
      license and code metadata files above to continue.
    </n-alert>

    <n-collapse v-if="devMode" class="mt-8" :default-expanded-names="['data']">
      <n-collapse-item title="data" name="data">
        <pre>{{ data }}</pre>
      </n-collapse-item>
    </n-collapse>
  </main>
</template>
