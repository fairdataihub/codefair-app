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

const sanitize = (html: string) => sanitizeHtml(html);

// definePageMeta({
// middleware: ["protected"],
// });

const route = useRoute();

const { identifier } = route.params as { identifier: string };

const formRef = ref<FormInst | null>(null);
const moduleData = reactive({
  licenseId: "",
  licenseContent: "",
});

const { data, error } = await useFetch(`/api/license/${identifier}`, {
  headers: useRequestHeaders(["cookie"]),
});

if (error.value) {
  console.log(error.value);

  push.error({
    title: "Something went wrong",
    message: "Please contact support",
  });

  navigateTo("/");
}

if (data.value) {
  moduleData.licenseId = data.value.licenseId;
  moduleData.licenseContent = data.value.licenseContent;
}
</script>

<template>
  <main class="">
    <n-form
      ref="formRef"
      :model="moduleData"
      size="large"
      label-placement="top"
      class="pr-4"
    >
      <n-form-item label="Rights" path="rights">
        <n-select
          v-model="moduleData.licenseId"
          placeholder="MIT License Modern Variant."
          clearable
          filterable
          :options="
            licensesJSON.map((option) => ({
              label: option.name,
              value: option.name,
            }))
          "
          @update:value="updateLicense"
          :value="licenseName !== '' ? licenseName : ''"
          :rule="{
            required: true,
            message: 'Please select a license',
            trigger: ['blur', 'change'],
          }"
        />
      </n-form-item>

      <FadeTransition>
        <LottieLoader v-if="getLicenseLoading" />

        <div>
          <div v-if="displayLicenseEditor" class="pb-5">
            <MdEditor
              v-model="draftLicense"
              language="en-US"
              preview-theme="github"
              :show-code-row-number="true"
              :sanitize="sanitize"
            />
          </div>
        </div>
      </FadeTransition>

      <n-divider />

      <div class="flex justify-start">
        <n-button
          size="large"
          type="primary"
          @click="saveMetadata"
          :loading="submitLoading"
        >
          <template #icon>
            <f-icon icon="material-symbols:save" />
          </template>

          Save Metadata
        </n-button>
      </div>
    </n-form>

    {{ data }}
  </main>
</template>
