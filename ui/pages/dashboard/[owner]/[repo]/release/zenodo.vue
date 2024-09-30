<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";
import CardDashboard from "~/components/card/CardDashboard.vue";

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

const zenodoLoginUrl = ref("");
const haveValidZenodoToken = ref(false);

const licenseChecked = ref(false);
const metadataChecked = ref(false);
const licenseId = ref("");
const metadataId  = ref("");

const allConfirmed = computed(() => licenseChecked.value && metadataChecked.value);

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
  console.log(data.value);
  zenodoLoginUrl.value = data.value.zenodoLoginUrl;
  haveValidZenodoToken.value = data.value.haveValidZenodoToken;
  licenseId.value = data.value.licenseId;
  metadataId.value = data.value.metadataId;
}
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

    <!-- <CardPlaceholder placeholder="Confirm license" /> -->
    
    <CardDashboard
      title="License"
      subheader="Confirm that the license is correct for your software and release. You can edit the license if needed."
    >
      <template #icon>
        <Icon name="tabler:license" size="40" />
      </template>

      <!-- Custom checkbox with a checkmark -->
      <template #action>
        <label class="flex items-center gap-3 cursor-pointer relative">
          <!-- Custom-styled checkbox with checkmark -->
          <input
            type="checkbox"
            :checked="licenseChecked"
            @change="licenseChecked = $event.target.checked"
            class="h-6 w-6 cursor-pointer appearance-none border border-gray-300 rounded-md checked:bg-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
          />
          <!-- Nuxt Icon that appears when checkbox is checked -->
          <Icon
            v-if="licenseChecked"
            name="mdi:check"
            size="24"
            class="absolute inset-0 text-white pointer-events-none"
          />
          <span class="text-slate-700 font-medium">Release with License as is</span>
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
    </CardDashboard>

    <CardDashboard
      title="Code metadata"
      subheader="Confirm that the code metadata is correct and up-to-date. You can edit the metadata if needed."
      class="mt-6"
    >
      <template #icon>
        <Icon name="tabler:code" size="40" />
      </template>

      <!-- Custom checkbox with a checkmark -->
      <template #action>
        <label class="flex items-center gap-2 cursor-pointer relative">
          <!-- Custom-styled checkbox with checkmark -->
          <input
            type="checkbox"
            :checked="metadataChecked"
            @change="metadataChecked = $event.target.checked"
            class="h-6 w-6 cursor-pointer appearance-none border border-gray-300 rounded-md checked:bg-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
          />
          <!-- Nuxt Icon that appears when checkbox is checked -->
          <Icon
            v-if="metadataChecked"
            name="mdi:check"
            size="24"
            class="absolute inset-0 text-white pointer-events-none"
          />
          <span class="text-slate-700 font-medium">Release with code metadata as is</span>
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
    </CardDashboard>

    <n-divider />

    <pre>{{ data }}</pre>

    <h2 class="pb-6">Login to Zenodo</h2>

    <p v-if="haveValidZenodoToken">
      Looks like we have a valid Zenodo token for you. You can now continue to
      the next step.
    </p>
    <p v-else>
      Looks like we don't have a valid Zenodo token for you. Please login to
      Zenodo using the button below.
    </p>

    <div>
      <a :href="zenodoLoginUrl" v-if="!haveValidZenodoToken">
        <n-button type="primary" :disabled="!allConfirmed">
          <template #icon>
            <Icon name="simple-icons:zenodo" size="16" />
          </template>
          Login to Zenodo
        </n-button>
      </a>
    </div>

    <CardPlaceholder placeholder="Login to Zenodo" />

    <CardPlaceholder placeholder="Select Zenodo deposition or create new" />

    <CardPlaceholder placeholder="?Select Zenodo community?" />

    <CardPlaceholder placeholder="Add zenodo required metadata" />

    <CardPlaceholder
      placeholder="Create draft github release (add additional executables and update release notes)"
    />

    <CardPlaceholder placeholder="Confirm github release" />

    <CardPlaceholder placeholder="Publish Zenodo release" />
  </main>
</template>
