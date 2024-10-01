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

const licenseChecked = ref(false);
const metadataChecked = ref(false);
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
      console.log("Form validation failed");
      console.log(errors);
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
      console.log(response);
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

    <!-- Confirm Metadata and License Section -->
    <CardCollapsible
      bordered
      :title="`Confirm Metadata and License for ${owner}/${repo}`"
      class="bg-white"
      horizontal
    >
      <div class="flex flex-row justify-around py-2">
        <CardIcon
          title="Confirm License"
          icon="tabler:license"
          subheader="Confirm that the license is correct and up-to-date. You can edit the license if needed."
          :edit-link="`/add/license/${licenseId}`"
          @click="licenseChecked = !licenseChecked"
        >
          <template #icon>
            <Icon name="tabler:license" size="40" />
          </template>

          <!-- Custom checkbox with a checkmark -->
          <template #action>
            <label class="relative flex cursor-pointer items-center gap-3">
              <!-- Custom-styled checkbox with checkmark -->
              <input
                type="checkbox"
                :checked="licenseChecked"
                class="h-6 w-6 cursor-pointer appearance-none rounded-md border border-gray-300 checked:bg-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
                @change="licenseChecked = $event.target.checked"
              />
              <!-- Nuxt Icon that appears when checkbox is checked -->
              <Icon
                v-if="licenseChecked"
                name="mdi:check"
                size="24"
                class="pointer-events-none absolute inset-0 text-white"
              />

              <span class="font-medium text-slate-700"
                >Release with License as is</span
              >
            </label>

            <NuxtLink :to="`/add/license/${licenseId}`">
              <n-button class="bg-indigo-500 text-white">
                <template #icon>
                  <Icon name="ri:settings-4-fill" />
                </template>
                Edit License
              </n-button>
            </NuxtLink>
          </template>
        </CardIcon>

        <CardIcon
          title="Confirm Code Metadata"
          subheader="Confirm that the code metadata is correct and up-to-date. You can edit the metadata if needed."
          icon="tabler:code"
          :edit-link="`/add/code-metadata/${metadataId}`"
          @click="metadataChecked = !metadataChecked"
        >
          <template #icon>
            <Icon name="tabler:code" size="40" />
          </template>

          <!-- Custom checkbox with a checkmark -->
          <template #action>
            <label class="relative flex cursor-pointer items-center gap-2">
              <!-- Custom-styled checkbox with checkmark -->
              <input
                type="checkbox"
                :checked="metadataChecked"
                class="h-6 w-6 cursor-pointer appearance-none rounded-md border border-gray-300 checked:bg-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
                @change="metadataChecked = $event.target.checked"
              />
              <!-- Nuxt Icon that appears when checkbox is checked -->
              <Icon
                v-if="metadataChecked"
                name="mdi:check"
                size="24"
                class="pointer-events-none absolute inset-0 text-white"
              />

              <span class="font-medium text-slate-700"
                >Release with code metadata as is</span
              >
            </label>

            <NuxtLink :to="`/add/code-metadata/${metadataId}`">
              <n-button class="bg-indigo-500 text-white">
                <template #icon>
                  <Icon name="ri:settings-4-fill" />
                </template>
                Edit code metadata
              </n-button>
            </NuxtLink>
          </template>
        </CardIcon>
      </div>
    </CardCollapsible>

    <n-divider />

    <!-- Zenodo Log In Section -->
    <CardCollapsible
      v-if="allConfirmed"
      title="Zenodo Log In"
      class="bg-white"
      bordered
    >
      <h2 class="pb-6">Login to Zenodo</h2>

      <p v-if="haveValidZenodoToken">
        Looks like we have a valid Zenodo token for you. You can now continue to
        the next step.
      </p>

      <p v-else>
        Looks like we don't have a valid Zenodo token for you. Please login to
        Zenodo using the button below.
      </p>

      <a v-if="!haveValidZenodoToken && allConfirmed" :href="zenodoLoginUrl">
        <n-button type="primary">
          <template #icon>
            <Icon name="simple-icons:zenodo" size="16" />
          </template>
          Login to Zenodo
        </n-button>
      </a>
    </CardCollapsible>

    <n-divider />

    <pre>{{ selectedDeposition }} {{ selectedExistingDeposition }}</pre>

    <!-- Select Zenodo Deposition -->
    <CardCollapsible title="Select Zenodo Deposition" bordered class="bg-white">
      <n-radio
        :checked="selectedExistingDeposition === 'existing'"
        value="existing"
        name="selectedExistingDeposition"
        @change="handleChange"
      >
        Existing Zenodo Deposition
      </n-radio>

      <n-radio
        :checked="selectedExistingDeposition === 'new'"
        value="new"
        name="selectedExistingDeposition"
        @change="handleChange"
      >
        New Zenodo Deposition
      </n-radio>

      <n-select
        v-if="selectedExistingDeposition === 'existing'"
        v-model:value="selectedDeposition"
        :options="selectableDepositions"
      />
    </CardCollapsible>

    <n-divider />

    <!-- Add Zenodo Metadata -->
    <CardCollapsible
      title="Add Zenodo required metadata"
      bordered
      class="bg-white"
    >
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

              <n-radio value="embargoed" disabled> Embargoed Access </n-radio>

              <n-radio value="restricted" disabled> Restricted Access </n-radio>

              <n-radio value="closed" disabled> Closed Access </n-radio>
            </n-flex>
          </n-radio-group>
        </n-form-item>

        <n-button @click="validateZenodoForm"> Validate </n-button>
      </n-form>
    </CardCollapsible>

    <n-divider />

    <!-- Create Draft Github Release -->
    <CardCollapsible
      bordered
      title="Create draft GitHub release"
      class="bg-white"
    >
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
          Your github release will be created in a draft state. Please make sure
          to add any additional executables and update the release notes. Once
          you are done, you can come back to this page and publish the release.
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

        <pre>{{ githubFormValue }}</pre>
      </n-form>
    </CardCollapsible>

    <n-divider />

    <h2 class="pb-6">Start the Zenodo publish process</h2>

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

    <n-collapse v-if="devMode" class="mt-8" :default-expanded-names="['data']">
      <n-collapse-item title="data" name="data">
        <pre>{{ data }}</pre>
      </n-collapse-item>
    </n-collapse>
  </main>
</template>
