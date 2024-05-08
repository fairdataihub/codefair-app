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

const showNotAuthorizedError = ref(false);
const requestClosed = ref(false);

const { data, error } = await useFetch(`/api/license/${identifier}`, {
  headers: useRequestHeaders(["cookie"]),
});

if (error.value) {
  const statusCode = error.value.statusCode ?? 500;
  const message = error.value.data.message ?? "Something went wrong";

  if (statusCode === 403) {
    showNotAuthorizedError.value = true;
  } else if (statusCode === 400) {
    if (message === "request closed") {
      requestClosed.value = true;

      push.error({
        title: "Request closed",
        message: "This request has been closed. You can't edit it anymore.",
      });
    }
  } else {
    push.error({
      title: "Something went wrong",
    });

    throw new Error("Something went wrong");
  }

  // navigateTo("/");
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

  console.log(licenseId.value, licenseContent.value);

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

const saveLicenseAndPush = () => {
  console.log("Save and push license to repository");
};
</script>

<template>
  <main class="">
    <div v-if="showNotAuthorizedError">
      <div class="flex items-center space-x-4">
        <img
          src="https://www.svgrepo.com/show/406101/locked.svg"
          alt="Not authorized"
          class="h-20 w-20"
        />

        <n-flex vertical>
          <h1>You are not authorized to view this page.</h1>
          <p>
            Please contact the owner of the repository to get access to this
            page.
          </p>
        </n-flex>
      </div>
    </div>
    <div v-else-if="requestClosed">
      <div class="flex items-center space-x-4">
        <img
          src="https://www.svgrepo.com/show/235034/close-sign.svg"
          alt="Not authorized"
          class="h-20 w-20"
        />

        <n-flex vertical>
          <h1>This request has been closed</h1>
          <p>
            This request has been marked as closed. This is due to the fact that
            the request has been completed or the request has been closed by the
            owner of the repository.
          </p>
        </n-flex>
      </div>
    </div>
    <div v-else>
      <n-flex vertical size="large" class="pb-5">
        <n-select
          v-model:value="licenseId"
          placeholder="MIT License Modern Variant"
          clearable
          size="large"
          filterable
          @update:value="updateLicenseContent"
          :options="licenseOptions"
        />

        <div v-if="displayLicenseEditor" class="pb-5">
          <MdEditor
            v-model="licenseContent"
            language="en-US"
            preview-theme="github"
            :show-code-row-number="true"
            :sanitize="sanitize"
          />
        </div>
      </n-flex>

      <n-divider />

      <n-flex>
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
