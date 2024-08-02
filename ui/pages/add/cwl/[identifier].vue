<script setup lang="ts">
import { config } from "md-editor-v3";
import licensesJSON from "@/assets/data/licenses.json";
import TargetBlankExtension from "@/utils/TargetBlankExtension";

config({
  editorConfig: {
    languageUserDefined: {
      "en-US": {
        footer: {
          markdownTotal: "Character Count",
          scrollAuto: "Scroll Auto",
        },
      },
      // toolBarsExclude: ["preview", "fullscreen"],
    },
  },
  markdownItConfig(md) {
    md.use(TargetBlankExtension);
  },
});

definePageMeta({
  middleware: ["protected"],
});

const licenseOptions = licensesJSON.map((option) => ({
  label: option.name,
  value: option.licenseId,
}));

const route = useRoute();

const { identifier } = route.params as { identifier: string };

const githubRepo = ref<string | null>(null);

const cwlContent = ref<string>("");

const displayLicenseEditor = ref(false);
const getLicenseLoading = ref(false);
const submitLoading = ref(false);
const validationMessage = ref<string>("");

const showSuccessModal = ref(false);
const pullRequestURL = ref<string>("");

const { data, error } = await useFetch(`/api/cwl/${identifier}`, {
  headers: useRequestHeaders(["cookie"]),
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
  cwlContent.value = data.value.cwlContent ?? "";
  githubRepo.value = `${data.value.owner}/${data.value.repo}`;
  validationMessage.value =
    data.value.validation_message ?? "No validation report to give.";

  if (cwlContent.value) {
    displayLicenseEditor.value = true;
  }

  console.log(validationMessage.value);
}

const navigateToPR = () => {
  showSuccessModal.value = false;
  window.open(pullRequestURL.value, "_blank");
};
</script>

<template>
  <main class="mx-auto max-w-screen-xl bg-white p-8">
    <n-flex vertical size="large" class="pb-5">
      <div class="flex flex-row justify-between">
        <h1 class="text-2xl font-bold">
          CWL validation report for
          <NuxtLink
            :to="`https://github.com/${githubRepo}`"
            target="_blank"
            class="text-blue-500 underline transition-all hover:text-blue-600"
          >
            {{ data?.repo }}
          </NuxtLink>
        </h1>
      </div>

      <div class="border-b border-dashed py-2">
        <p class="text-base">
          The validation report below was generated with the
          <NuxtLink
            target="_blank"
            to="https://github.com/common-workflow-lab/cwl-ts-auto?tab=readme-ov-file#cwl-ts-auto"
            class="text-blue-500 underline transition-all hover:text-blue-600"
          >
            CWL typescript validator.
          </NuxtLink>
          You can get a more detailed report using the 'cwltool --validate' if
          you would like. Refer to the
          <NuxtLink
            to="https://cwltool.readthedocs.io/en/latest/"
            target="_blank"
            class="text-blue-500 underline transition-all hover:text-blue-600"
          >
            CWLTool documentation.
          </NuxtLink>
          Codefair will run the validation again after you push changes to the
          main branch.
        </p>
      </div>

      <!-- <n-form-item
        class="mb-3 mt-5 font-bold"
        :show-feedback="false"
        size="large"
      >
        <template #label>
          <p class="pb-1 text-base font-bold">Select a license</p>
        </template>

        <n-select
          v-model:value="licenseId"
          placeholder="MIT License Modern Variant"
          clearable
          size="large"
          filterable
          :options="licenseOptions"
          @update:value="updateLicenseContent"
        />
      </n-form-item> -->

      <!-- <TransitionFade>
        <div v-if="displayLicenseEditor">
          <n-form-item :show-feedback="false" size="large">
            <template #label>
              <p class="pb-1 text-base font-bold">
                Edit your .cwl file if required
                <span class="text-right text-xs text-stone-500">
                  (You can use the left panel to edit the content and right
                  panel to preview the changes)
                </span>
              </p>
            </template>

            <MdEditor
              v-model="cwlContent"
              language="en-US"
              :toolbars-exclude="[
                'preview',
                'fullscreen',
                'save',
                'pageFullscreen',
                'github',
                'catalog',
              ]"
              preview-theme="github"
              :show-code-row-number="true"
              :sanitize="sanitize"
            />
          </n-form-item>
        </div>
      </TransitionFade> -->
    </n-flex>

    <!-- <n-divider /> -->

    <!-- <n-flex class="my-4" justify="space-between">
      <n-button
        size="large"
        color="black"
        :loading="submitLoading"
        :disabled="!cwlContent"
        @click="saveLicenseDraft"
      >
        <template #icon>
          <Icon name="material-symbols:save" />
        </template>

        Save draft
      </n-button>

      <n-button
        size="large"
        color="black"
        x
        :disabled="!cwlContent"
        :loading="submitLoading"
        @click="saveLicenseAndPush"
      >
        <template #icon>
          <Icon name="ion:push" />
        </template>
        Save and push license to repository
      </n-button>
    </n-flex> -->

    <!-- <n-modal v-model:show="showSuccessModal" transform-origin="center">
      <n-card
        style="width: 600px"
        title="One more thing!"
        :bordered="false"
        size="huge"
        role="dialog"
        aria-modal="true"
      >
        A pull request to update the license file has been submitted. Please
        approve the pull request to make the changes live.
        <template #footer>
          <n-flex justify="end">
            <n-button type="success" @click="navigateToPR">
              <template #icon>
                <Icon name="icon-park-outline:success" />
              </template>
              View Pull Request
            </n-button>
          </n-flex>
        </template>
      </n-card>
    </n-modal> -->

    <pre>{{ cwlContent }}</pre>

    <n-divider />

    <div>
      <pre>{{ validationMessage }}</pre>
    </div>
  </main>
</template>
