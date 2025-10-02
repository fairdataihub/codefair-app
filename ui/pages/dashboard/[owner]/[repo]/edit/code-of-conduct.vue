<script setup lang="ts">
import sanitizeHtml from "sanitize-html";
import { MdEditor, config } from "md-editor-v3";
import TargetBlankExtension from "@/utils/TargetBlankExtension";
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";
import cofcJSON from "@/assets/data/codeOfConduct.json";

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

const breadcrumbsStore = useBreadcrumbsStore();
breadcrumbsStore.showBreadcrumbs();
breadcrumbsStore.setFeature({
  id: "edit-cod",
  name: "Edit Code of Conduct",
  icon: "octicon:code-of-conduct-16",
});

const route = useRoute();

const { owner, repo } = route.params as { owner: string; repo: string };

const cofcContent = ref("");
const cofcTitle = ref("");

const displayEditor = ref(false);
const submitLoading = ref(false);

const showSuccessModal = ref(false);
const pullRequestURL = ref("");
const cofcOptions = cofcJSON.map((option) => ({
  label: option.name,
  value: option.name,
}));

const { data, error } = await useFetch(
  `/api/${owner}/${repo}/code-of-conduct`,
  {
    headers: useRequestHeaders(["cookie"]),
    method: "GET",
  },
);

if (error.value) {
  push.error({
    title: "Failed to fetch Code of Conduct details",
    message: "Please try again later",
  });

  console.error("Failed to fetch Code of Conduct details:", error.value);

  throw createError(error.value);
}

if (data.value) {
  cofcContent.value = data.value?.codeContent ?? "";
  cofcTitle.value = data.value?.codeTitle ?? "";
  displayEditor.value = true;
}

const sanitize = (html: string) => sanitizeHtml(html);

const updateCodeContent = (value: string) => {
  const cofc = cofcJSON.find((item) => item.name === value);

  if (cofc) {
    const { template } = cofc;
    cofcTitle.value = value;
    if (value !== "Custom") {
      cofcContent.value = template ?? "";
    } else {
      cofcContent.value = data.value?.codeContent ?? "";
    }
  }
};

const saveDraft = async () => {
  submitLoading.value = true;

  const body = {
    codeContent: cofcContent.value,
    codeTitle: cofcTitle.value,
  };

  await $fetch(`/api/${owner}/${repo}/code-of-conduct`, {
    body: JSON.stringify(body),
    headers: useRequestHeaders(["cookie"]),
    method: "PUT",
  })
    .then((_response) => {
      push.success({
        title: "Draft saved",
        message: "You can continue editing now or come back later",
      });
    })
    .catch((error) => {
      console.error("Failed to save Code of Conduct draft:", error);
      push.error({
        title: "Failed to save Code of Conduct draft",
        message: "Please try again later",
      });
    })
    .finally(() => {
      submitLoading.value = false;
    });
};

const saveAndPush = async () => {
  submitLoading.value = true;

  const body = {
    codeContent: cofcContent.value,
    codeTitle: cofcTitle.value,
  };

  await $fetch(`/api/${owner}/${repo}/code-of-conduct`, {
    body: JSON.stringify(body),
    headers: useRequestHeaders(["cookie"]),
    method: "POST",
  })
    .then((response) => {
      if ("prUrl" in response) {
        push.success({
          title: "Code of Conduct pushed to repository",
          message: "Review the changes in the repository",
        });

        showSuccessModal.value = true;
        pullRequestURL.value = response.prUrl;
      } else {
        push.error({
          title: "Failed to push Code of Conduct to repository",
          message: "Please try again later",
        });
      }
    })
    .catch((error) => {
      console.error("Failed to push Code of Conduct to repository:", error);
      push.error({
        title: "Failed to push Code of Conduct to repository",
        message: "Please try again later",
      });
    })
    .finally(() => {
      submitLoading.value = false;
    });
};

const navigateToPR = () => {
  showSuccessModal.value = false;
  window.open(pullRequestURL.value, "_blank");
};
</script>

<template>
  <main class="pb-8">
    <section
      class="mx-auto max-w-screen-xl rounded-md border-[1px] border-gray-200 bg-white p-8 shadow-md dark:bg-gray-600"
    >
      <n-flex vertical size="large" class="pb-5">
        <div class="flex flex-row justify-between">
          <h1 class="text-2xl font-bold dark:text-slate-200">
            Edit CODE_OF_CONDUCT.md for
            <NuxtLink
              :to="`https://github.com/${owner}/${repo}`"
              target="_blank"
              class="text-blue-500 underline transition-all hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {{ repo }}
            </NuxtLink>
          </h1>

          <NuxtLink
            to="https://docs.codefair.io/docs/code-of-conduct.html"
            target="_blank"
            class="font-semibold text-[var(--link-color)] underline transition-all hover:text-[var(--link-hover)] dark:text-indigo-300 dark:hover:text-indigo-400"
            >Need help?</NuxtLink
          >
        </div>

        <div class="border-b border-dashed py-2">
          <p class="text-base dark:text-stone-100">
            You can edit your Code of Conduct file here. The Code of Conduct
            file is a markdown file that provides guidelines for the community.
            It helps to create a safe and inclusive environment for all
            contributors.
          </p>
        </div>

        <n-form-item class="mb-3 mt-5" :show-feedback="false" size="large">
          <template #label>
            <p class="pb-1 text-base font-bold">
              Select a Code of Conduct template
            </p>
          </template>

          <n-select
            v-model:value="cofcTitle"
            placeholder="Code of Conduct"
            clearable
            size="large"
            filterable
            :options="cofcOptions"
            @update:value="updateCodeContent"
          />
        </n-form-item>

        <TransitionFade>
          <n-form-item
            v-show="displayEditor"
            :show-feedback="false"
            size="large"
          >
            <template #label>
              <p class="pb-1 text-base font-bold">
                Edit your Code of Conduct as required
                <span class="text-right text-xs dark:text-stone-200">
                  (You can use the left panel to edit the content and right
                  panel to preview the changes)
                </span>
              </p>
            </template>

            <MdEditor
              v-model="cofcContent"
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
        </TransitionFade>
      </n-flex>

      <n-divider />

      <n-flex class="my-4" justify="space-between">
        <n-flex justify="start">
          <n-button
            size="large"
            color="black"
            :loading="submitLoading"
            :disabled="!cofcContent"
            @click="saveDraft"
          >
            <template #icon>
              <Icon name="material-symbols:save" />
            </template>

            Save draft
          </n-button>
        </n-flex>

        <n-button
          size="large"
          color="black"
          :disabled="!cofcContent"
          :loading="submitLoading"
          @click="saveAndPush"
        >
          <template #icon>
            <Icon name="ion:push" />
          </template>
          Save and push Code of Conduct to repository
        </n-button>
      </n-flex>

      <n-modal v-model:show="showSuccessModal" transform-origin="center">
        <n-card
          style="width: 600px"
          title="One more thing!"
          :bordered="false"
          size="huge"
          role="dialog"
          aria-modal="true"
          class="dark:bg-gray-600"
        >
          A pull request to update the Code of Conduct file has been submitted.
          Please approve the pull request to make the changes live.
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
      </n-modal>
    </section>
  </main>
</template>
