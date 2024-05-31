<script setup lang="ts">
import sanitizeHtml from "sanitize-html";
import { MdEditor, config } from "md-editor-v3";
import type { FormInst, FormItemRule, SelectOption } from "naive-ui";
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

const licenseId = ref<string | null>(null);
const licenseContent = ref<string>("");

const displayLicenseEditor = ref(false);
const getLicenseLoading = ref(false);
const submitLoading = ref(false);

const { data, error } = await useFetch(`/api/license/${identifier}`, {
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
  licenseId.value = data.value.licenseId ?? null;
  licenseContent.value = data.value.licenseContent ?? "";

  if (licenseContent.value) {
    displayLicenseEditor.value = true;
  }
}

const sanitize = (html: string) => sanitizeHtml(html);

const updateLicenseContent = async (value: string) => {
  if (!value) {
    return;
  }

  displayLicenseEditor.value = false;

  const license = licensesJSON.find((item) => item.licenseId === value);

  if (license) {
    getLicenseLoading.value = true;
    const notification = push.promise(
      "Please wait while we fetch the license details...",
    );

    await $fetch(`/api/license/request/${license.licenseId}`, {
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
  submitLoading.value = true;

  const body = {
    licenseId: licenseId.value,
    licenseContent: licenseContent.value,
  };

  await $fetch(`/api/license/${identifier}`, {
    method: "PUT",
    headers: useRequestHeaders(["cookie"]),
    body: JSON.stringify(body),
  })
    .then((_response) => {
      push.success({
        title: "License draft saved",
        message: "You can continue editing",
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

const saveLicenseAndPush = async () => {
  submitLoading.value = true;

  const body = {
    licenseId: licenseId.value,
    licenseContent: licenseContent.value,
  };

  await $fetch(`/api/license/${identifier}`, {
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

        window.open(response.prUrl, "_blank");
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
</script>

<template>
  <main class="mx-auto max-w-screen-xl">
    <div class="bg-white p-8">
      <n-flex vertical size="large" class="pb-5">
        <h1 class="text-2xl font-bold">Edit LICENSE</h1>
        <n-text type="secondary" class="mt-2 text-lg">
          To make your software reusable a license file is expected at the root level of your repository, as recommended in the FAIR-BioRS Guidelines. It is important to choose your license early since it will affect your software's dependencies.
        </n-text>

        <n-text type="secondary">
          You can select a license from the list below and edit it in the
          editor. Once you are done, you can save the draft or push the license to the repository as a pull request.
        </n-text>

        <n-select
          v-model:value="licenseId"
          placeholder="MIT License Modern Variant"
          clearable
          size="large"
          filterable
          @update:value="updateLicenseContent"
          :options="licenseOptions"
        />

        <!-- help text -->
        <n-text v-if="displayLicenseEditor" class="mt-2">
            Your edits will update the preview on the right side. You can edit the license content on the left side using the editor.
        </n-text>

        <TransitionFade>
          <div v-if="displayLicenseEditor" class="my-5">
            <MdEditor
              v-model="licenseContent"
              language="en-US"
              :toolbars-exclude="['preview', 'fullscreen', 'save', 'pageFullscreen', 'github', 'catalog']"
              preview-theme="github"
              :show-code-row-number="true"
              :sanitize="sanitize"
            />
          </div>
        </TransitionFade>
      </n-flex>

      <n-divider />

      <n-flex class="my-4">
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
          color="black"x
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
    </div>
  </main>
</template>
