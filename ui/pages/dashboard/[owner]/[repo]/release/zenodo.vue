<script setup lang="ts">
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

const zenodoLoginUrl = ref("");
const haveValidZenodoToken = ref(false);

const selectedExistingDeposition = ref<String | null>(null);
const selectedDeposition = ref<String | null>(null);

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
  selectedExistingDeposition.value = data.value.existingZenodoDepositionId
    ? "existing"
    : data;
}

const handleChange = (e: Event) => {
  selectedExistingDeposition.value = (e.target as HTMLInputElement).value;
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

    <CardPlaceholder placeholder="Confirm license" />

    <CardPlaceholder placeholder="Confirm code metadata" />

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

    <a v-if="!haveValidZenodoToken" :href="zenodoLoginUrl">
      <n-button type="primary">
        <template #icon>
          <Icon name="simple-icons:zenodo" size="16" />
        </template>
        Login to Zenodo
      </n-button>
    </a>

    <n-divider />

    <h2 class="pb-6">Select Zenodo deposition</h2>

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
      v-model:value="selectedDeposition"
      :options="generateSelectableDepositions()"
    />

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
