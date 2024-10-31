<script setup lang="ts">
import sanitizeHtml from "sanitize-html";
import { MdEditor, config } from "md-editor-v3";
import licensesJSON from "@/assets/data/licenses.json";
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

const licenseOptions = licensesJSON.map((option) => ({
  label: option.name,
  value: option.licenseId,
}));

const route = useRoute();

const { owner, repo } = route.params as { owner: string; repo: string };

const licenseId = ref<string | null>(null);
const licenseContent = ref("");
const customLicenseTitle = ref("");

const displayLicenseEditor = ref(false);
const getLicenseLoading = ref(false);
const submitLoading = ref(false);

const showSuccessModal = ref(false);
const pullRequestURL = ref("");

const { data, error } = await useFetch(`/api/${owner}/${repo}/license`, {
  headers: useRequestHeaders(["cookie"]),
});

breadcrumbsStore.setFeature({
  id: "edit-license",
  icon: "tabler:license",
  name: "Edit License",
});

if (error.value) {
  push.error({
    title: "Failed to fetch license details",
    message: "Please try again later",
  });

  console.error("Failed to fetch license details:", error.value);

  throw createError(error.value);
}

if (data.value) {
  licenseId.value = data.value.licenseId || null;
  licenseContent.value = data.value.licenseContent ?? "";
  customLicenseTitle.value = data.value.customLicenseTitle ?? "";

  if (licenseContent.value) {
    displayLicenseEditor.value = true;
  }
}

const sanitize = (html: string) => sanitizeHtml(html);

const updateLicenseContent = async (value: string) => {
  if (!value) {
    return;
  }

  if (value === "Custom") {
    licenseContent.value = data.value?.licenseContent || "";
    customLicenseTitle.value = data.value?.customLicenseTitle || "";
    push.warning({
      title: "Custom license",
      message:
        "Your license content was reset to the original terms. Please be aware that this license may not be publishable on some archival repositories.",
    });

    displayLicenseEditor.value = true;

    return;
  }

  displayLicenseEditor.value = false;

  const license = licensesJSON.find((item) => item.licenseId === value);

  if (license) {
    getLicenseLoading.value = true;
    const notification = push.promise(
      "Please wait while we fetch the license details...",
    );

    await $fetch(`/api/request/license/${license.licenseId}`, {
      headers: useRequestHeaders(["cookie"]),
    })
      .then((response) => {
        licenseContent.value = response.licenseText;

        notification.resolve({
          title: "License details fetched",
          message: "You can continue editing",
        });

        displayLicenseEditor.value = true;
      })
      .catch((error) => {
        console.error("Failed to fetch license details:", error);
        notification.reject({
          title: "Failed to fetch license details",
          message: "Please try again later",
        });
      })
      .finally(() => {
        getLicenseLoading.value = false;
      });
  }
};

const saveLicenseDraft = async () => {
  if (licenseId.value === "Custom" && !customLicenseTitle.value.trim()) {
    push.error({
      title: "Custom license title required",
      message: "Please enter a custom license title",
    });
    return;
  }

  submitLoading.value = true;

  const body = {
    licenseId: licenseId.value,
    licenseContent: licenseContent.value,
    customLicenseTitle: customLicenseTitle.value,
  };

  await $fetch(`/api/${owner}/${repo}/license`, {
    method: "PUT",
    headers: useRequestHeaders(["cookie"]),
    body: JSON.stringify(body),
  })
    .then((_response) => {
      push.success({
        title: "Draft saved",
        message: "You can continue editing now or come back later",
      });
    })
    .catch((error) => {
      console.error("Failed to save license draft:", error);
      push.error({
        title: "Failed to save license draft",
        message: "Please try again later",
      });
    })
    .finally(() => {
      submitLoading.value = false;
    });
};

const saveCustomTitle = async () => {
  if (licenseId.value === "Custom" && !customLicenseTitle.value.trim()) {
    push.error({
      title: "Custom license title required",
      message: "Please enter a custom license title",
    });
    return;
  }

  submitLoading.value = true;

  const body = {
    licenseId: licenseId.value,
    licenseContent: licenseContent.value,
    customLicenseTitle: customLicenseTitle.value,
  };

  await $fetch(`/api/${owner}/${repo}/license/custom_title`, {
    method: "PUT",
    headers: useRequestHeaders(["cookie"]),
    body: JSON.stringify(body),
  })
    .then((_response) => {
      push.success({
        title: "Custom title saved",
      });
    })
    .catch((error) => {
      console.error("Failed to save custom license title:", error);
      push.error({
        title: "Failed to save custom license title",
        message: "Please try again later",
      });
    })
    .finally(() => {
      submitLoading.value = false;
    });
};

const saveLicenseAndPush = async () => {
  if (licenseId.value === "Custom" && !customLicenseTitle.value.trim()) {
    push.error({
      title: "Custom license title required",
      message: "Please enter a custom license title",
    });
    return;
  }

  submitLoading.value = true;

  const body = {
    licenseId: licenseId.value,
    licenseContent: licenseContent.value,
    customLicenseTitle: customLicenseTitle.value,
  };

  await $fetch(`/api/${owner}/${repo}/license`, {
    method: "POST",
    headers: useRequestHeaders(["cookie"]),
    body: JSON.stringify(body),
  })
    .then((response) => {
      if ("prUrl" in response) {
        push.success({
          title: "License pushed to repository",
          message: "Review the changes in the repository",
        });

        showSuccessModal.value = true;
        pullRequestURL.value = response.prUrl;
      } else {
        push.error({
          title: "Failed to push license to repository",
          message: "Please try again later",
        });
      }
    })
    .catch((error) => {
      console.error("Failed to push license to repository:", error);
      push.error({
        title: "Failed to push license to repository",
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
  <main class="mx-auto max-w-screen-xl bg-white p-8">
    <n-flex vertical size="large" class="pb-5">
      <div class="flex flex-row justify-between">
        <h1 class="text-2xl font-bold">
          Edit LICENSE for
          <NuxtLink
            :to="`https://github.com/${owner}/${repo}`"
            target="_blank"
            class="text-blue-500 underline transition-all hover:text-blue-600"
          >
            {{ repo }}
          </NuxtLink>
        </h1>

        <NuxtLink
          to="https://docs.codefair.io/docs/license.html"
          target="_blank"
          class="text-blue-400 underline transition-all hover:text-blue-500"
          >Need help?</NuxtLink
        >
      </div>

      <div class="border-b border-dashed py-2">
        <p class="text-base">
          You can select a license from the list below and edit further. Once
          you are done, you can save the draft or push the license to the
          repository. If you need help with with deciding which one to pick, you
          can check out
          <NuxtLink
            to="https://choosealicense.com"
            target="_blank"
            class="text-blue-500 underline transition-all hover:text-blue-600"
            >https://choosealicense.com</NuxtLink
          >. To make your software reusable a license file is expected at the
          root level of your repository. It is important to choose your license
          early since it will affect your software's dependencies.
        </p>
      </div>

      <n-form-item class="mb-3 mt-5" :show-feedback="false" size="large">
        <template #label>
          <p class="pb-1 text-base font-bold">Select a license</p>
        </template>

        <n-select
          v-model:value="licenseId"
          placeholder="MIT License Modern Variant"
          clearable
          size="large"
          filterable
          @update:value="updateLicenseContent"
          :options="licenseOptions"
        />
      </n-form-item>

      <n-alert v-if="licenseId === 'Custom'" type="warning" class="w-full">
        <p class="text-base">
          This repository uses a custom license. We recommend using a license
          that is within the list of allowed licenses as custom licenses may not
          be publishable on some archival repositories.
        </p>
      </n-alert>

      <n-form-item v-show="licenseId === 'Custom'" show-require-mark>
        <template #label>
          <p class="pb-1 text-base font-bold">Custom license title</p>
        </template>

        <n-input
          v-model:value="customLicenseTitle"
          size="large"
          placeholder="My custom license title"
          clearable
        />
      </n-form-item>

      <TransitionFade>
        <n-form-item
          :show-feedback="false"
          size="large"
          v-show="displayLicenseEditor"
        >
          <template #label>
            <p class="pb-1 text-base font-bold">
              Edit your license if required
              <span class="text-right text-xs text-stone-500">
                (You can use the left panel to edit the content and right panel
                to preview the changes)
              </span>
            </p>
          </template>

          <MdEditor
            v-model="licenseContent"
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
      <n-flex 
        justify="start"
      >
        <n-button
          size="large"
          color="black"
          @click="saveLicenseDraft"
          :loading="submitLoading"
          :disabled="!licenseId || !licenseContent"
        >
          <template #icon>
            <Icon name="material-symbols:save" />
          </template>

          Save draft
        </n-button>
        <n-button
          size="large"
          color="black"
          @click="saveCustomTitle"
          :disabled="
            (!customLicenseTitle || !licenseContent) && licenseId === 'Custom'
          "
          v-if="licenseId === 'Custom'"
          :loading="submitLoading"
        >
          <template #icon>
            <Icon name="material-symbols:save" />
          </template>
          Save license title
        </n-button>
      </n-flex>
      <n-button
        size="large"
        color="black"
        @click="saveLicenseAndPush"
        :disabled="!licenseId || !licenseContent"
        :loading="submitLoading"
      >
        <template #icon>
          <Icon name="ion:push" />
        </template>
        Save and push license to repository
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
    </n-modal>
  </main>
</template>
