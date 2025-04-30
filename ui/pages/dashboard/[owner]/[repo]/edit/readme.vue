<script setup lang="ts">
import sanitizeHtml from "sanitize-html";
import { MdEditor, config } from "md-editor-v3";
import TargetBlankExtension from "@/utils/TargetBlankExtension";
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

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

const route = useRoute();

const { owner, repo } = route.params as { owner: string; repo: string };

const readmeContent = ref("");

const displayReadmeEditor = ref(false);
const submitLoading = ref(false);

const showSuccessModal = ref(false);
const pullRequestURL = ref("");

interface ReadmeResponse {
  readmeContent: string;
  timestamp: number;
}

const { data, error } = await useFetch<ReadmeResponse>(
  `/api/${owner}/${repo}/readme`,
  {
    headers: useRequestHeaders(["cookie"]),
    method: "GET",
  },
);

breadcrumbsStore.setFeature({
  id: "edit-readme",
  name: "Edit README",
  icon: "gg:readme",
});

if (error.value) {
  push.error({
    title: "Failed to fetch readme details",
    message: "Please try again later",
  });

  console.error("Failed to fetch readme details:", error.value);

  throw createError(error.value);
}

if (data.value) {
  readmeContent.value = data.value.readmeContent ?? "";

  if (readmeContent.value) {
    displayReadmeEditor.value = true;
  }
}

const sanitize = (html: string) => sanitizeHtml(html);

const saveReadmeDraft = async () => {
  submitLoading.value = true;

  const body = {
    readmeContent: readmeContent.value,
  };

  await $fetch(`/api/${owner}/${repo}/readme`, {
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
      console.error("Failed to save README draft:", error);
      push.error({
        title: "Failed to save README draft",
        message: "Please try again later",
      });
    })
    .finally(() => {
      submitLoading.value = false;
    });
};

const saveReadmeAndPush = async () => {
  submitLoading.value = true;

  const body = {
    readmeContent: readmeContent.value,
  };

  await $fetch(`/api/${owner}/${repo}/readme`, {
    body: JSON.stringify(body),
    headers: useRequestHeaders(["cookie"]),
    method: "POST",
  })
    .then((response) => {
      if ("prUrl" in response) {
        push.success({
          title: "README pushed to repository",
          message: "Review the changes in the repository",
        });

        showSuccessModal.value = true;
        pullRequestURL.value = response.prUrl;
      } else {
        push.error({
          title: "Failed to push README to repository",
          message: "Please try again later",
        });
      }
    })
    .catch((error) => {
      console.error("Failed to push README to repository:", error);
      push.error({
        title: "Failed to push README to repository",
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
      class="mx-auto max-w-screen-xl rounded-md border-[1px] border-gray-200 bg-white p-8 shadow-md"
    >
      <n-flex vertical size="large" class="pb-5">
        <div class="flex flex-row justify-between">
          <h1 class="text-2xl font-bold">
            Edit README for
            <NuxtLink
              :to="`https://github.com/${owner}/${repo}`"
              target="_blank"
              class="text-blue-500 underline transition-all hover:text-blue-600"
            >
              {{ repo }}
            </NuxtLink>
          </h1>

          <NuxtLink
            to="https://docs.codefair.io/docs/readme.html"
            target="_blank"
            class="text-blue-400 underline transition-all hover:text-blue-500"
            >Need help?</NuxtLink
          >
        </div>

        <div class="border-b border-dashed py-2">
          <p class="text-base">
            You can edit your README file here. The README file is a markdown
            file that contains information about your project. It is usually the
            first thing that users see when they visit your project on GitHub.
            Try to make it as informative and helpful as possible.
          </p>
        </div>

        <TransitionFade>
          <n-form-item
            v-show="displayReadmeEditor"
            :show-feedback="false"
            size="large"
          >
            <template #label>
              <p class="pb-1 text-base font-bold">
                Edit your README as required
                <span class="text-right text-xs text-stone-500">
                  (You can use the left panel to edit the content and right
                  panel to preview the changes)
                </span>
              </p>
            </template>

            <MdEditor
              v-model="readmeContent"
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
            :disabled="!readmeContent"
            @click="saveReadmeDraft"
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
          :disabled="!readmeContent"
          :loading="submitLoading"
          @click="saveReadmeAndPush"
        >
          <template #icon>
            <Icon name="ion:push" />
          </template>
          Save and push README to repository
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
          A pull request to update the README file has been submitted. Please
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
      </n-modal>
    </section>
  </main>
</template>
