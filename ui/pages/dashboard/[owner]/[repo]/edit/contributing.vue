<script setup lang="ts">
import sanitizeHtml from "sanitize-html";
import { MdEditor, config } from "md-editor-v3";
import TargetBlankExtension from "@/utils/TargetBlankExtension";
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";
import contribJson from "@/assets/data/contributing.json";
const colorMode = useColorMode();
const isDark = computed({
  get: () => colorMode.value === "dark",
  set: (v) => (colorMode.preference = v ? "dark" : "light"),
});

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
  id: "edit-contributing",
  name: "Edit CONTRIBUTING.md",
  icon: "carbon:collaborate",
});

const route = useRoute();

const { owner, repo } = route.params as { owner: string; repo: string };

const contribContent = ref("");
const contribTitle = ref("");

const displayEditor = ref(false);
const submitLoading = ref(false);

const showSuccessModal = ref(false);
const pullRequestURL = ref("");
const contribOptions = contribJson.map((option) => ({
  label: option.name,
  value: option.name,
}));

const { data, error } = await useFetch(`/api/${owner}/${repo}/contributing`, {
  headers: useRequestHeaders(["cookie"]),
  method: "GET",
});

if (error.value) {
  push.error({
    title: "Failed to fetch CONTRIBUTING.md details",
    message: "Please try again later",
  });

  console.error("Failed to fetch CONTRIBUTING.md details:", error.value);

  throw createError(error.value);
}

if (data.value) {
  contribContent.value = data.value?.contribContent ?? "";
  contribTitle.value = data.value?.contribTitle ?? "";
  displayEditor.value = true;
}

const sanitize = (html: string) => sanitizeHtml(html);

const updateContribContent = (value: string) => {
  const contrib = contribJson.find((item) => item.name === value);

  if (contrib) {
    const { template } = contrib;
    contribTitle.value = value;
    if (value !== "Custom") {
      contribContent.value = template;
    } else {
      contribContent.value = data.value?.contribContent ?? "";
    }
  }
};

const saveDraft = async () => {
  submitLoading.value = true;

  const body = {
    contribContent: contribContent.value,
    contribTitle: contribTitle.value,
  };

  await $fetch(`/api/${owner}/${repo}/contributing`, {
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
      console.error("Failed to save CONTRIBUTING.md draft:", error);
      push.error({
        title: "Failed to save CONTRIBUTING.md draft",
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
    contribContent: contribContent.value,
    contribTitle: contribTitle.value,
  };

  await $fetch(`/api/${owner}/${repo}/contributing`, {
    body: JSON.stringify(body),
    headers: useRequestHeaders(["cookie"]),
    method: "POST",
  })
    .then((response) => {
      if ("prUrl" in response) {
        push.success({
          title: "CONTRIBUTING.md pushed to repository",
          message: "Review the changes in the repository",
        });

        showSuccessModal.value = true;
        pullRequestURL.value = response.prUrl;
      } else {
        push.error({
          title: "Failed to push CONTRIBUTING.md to repository",
          message: "Please try again later",
        });
      }
    })
    .catch((error) => {
      console.error("Failed to push CONTRIBUTING.md to repository:", error);
      push.error({
        title: "Failed to push CONTRIBUTING.md to repository",
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
      class="mx-auto max-w-screen-xl rounded-md border-[1px] border-gray-200 bg-white p-8 shadow-md dark:bg-slate-300"
    >
      <n-flex vertical size="large" class="pb-5">
        <div class="flex flex-row justify-between">
          <h1 class="text-2xl font-bold dark:text-black">
            Edit CONTRIBUTING.md for
            <NuxtLink
              :to="`https://github.com/${owner}/${repo}`"
              target="_blank"
              class="text-blue-500 underline transition-all hover:text-blue-600"
            >
              {{ repo }}
            </NuxtLink>
          </h1>

          <NuxtLink
            to="https://docs.codefair.io/docs/contributing.html"
            target="_blank"
            class="font-semibold text-[var(--link-color)] underline transition-all hover:text-[var(--link-hover)]"
            >Need help?</NuxtLink
          >
        </div>

        <div class="border-b border-dashed py-2">
          <p class="text-base dark:text-gray-700">
            You can edit your CONTRIBUTING.md file here. The CONTRIBUTING.md
            file is a markdown file that contains information about your
            project. It is usually the first thing that users see when they
            visit your project on GitHub. Try to make it as informative and
            helpful as possible.
          </p>
        </div>

        <n-form-item class="mb-3 mt-5" :show-feedback="false" size="large">
          <template #label>
            <p class="pb-1 text-base font-bold">
              Select a Contributing template
            </p>
          </template>

          <n-select
            v-model:value="contribTitle"
            placeholder="Code of Conduct"
            clearable
            size="large"
            filterable
            :options="contribOptions"
            @update:value="updateContribContent"
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
                Edit your CONITRUBITING.md as required
                <span class="text-right text-xs text-stone-500">
                  (You can use the left panel to edit the content and right
                  panel to preview the changes)
                </span>
              </p>
            </template>

            <MdEditor
              v-model="contribContent"
              language="en-US"
              :theme="isDark ? 'dark' : 'light'"
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
            :disabled="!contribContent"
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
          :disabled="!contribContent"
          :loading="submitLoading"
          @click="saveAndPush"
        >
          <template #icon>
            <Icon name="ion:push" />
          </template>
          Save and push CONTRIBUTING.md to repository
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
        >
          A pull request to update the Contributing file has been submitted.
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
