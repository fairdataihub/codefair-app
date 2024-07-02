<script setup lang="ts">
import { generate } from "random-words";
const route = useRoute();

const { owner, repo } = route.params as { owner: string; repo: string };

const botNotInstalled = ref(false);

const { data, error } = await useFetch(`/api/dashboard/${owner}/${repo}`, {
  headers: useRequestHeaders(["cookie"]),
});

if (error.value) {
  console.error(error.value);

  if (error.value.statusMessage === "installation-not-found") {
    // codefair bot is not installed on the repo.
    botNotInstalled.value = true;
  } else {
    push.error({
      title: "Something went wrong",
      message:
        "Could not fetch the data for the dashboard. Please try again later.",
    });

    throw createError(error.value);
  }
}

const licenseRequests = computed(() => {
  if (!data.value) {
    return {
      closed: [],
      open: [],
    };
  }

  const openLicenseRequests = data.value?.licenseRequests.filter(
    (request) => request.open,
  );

  const closedLicenseRequests = data.value?.licenseRequests.filter(
    (request) => !request.open,
  );

  return {
    closed: closedLicenseRequests,
    open: openLicenseRequests,
  };
});

const generateSeed = (seed: string) => {
  return generate({
    join: "-",
    max: 3,
    min: 3,
    seed,
  });
};
</script>

<template>
  <main class="mx-auto max-w-screen-xl px-8 pb-8 pt-4">
    <n-breadcrumb class="pb-5">
      <n-breadcrumb-item :clickable="false">
        <Icon name="ri:dashboard-fill" />

        Dashboard
      </n-breadcrumb-item>

      <n-breadcrumb-item :clickable="false" :href="`/dashboard/${owner}`">
        <Icon name="uil:github" />
        {{ owner }}
      </n-breadcrumb-item>

      <n-breadcrumb-item>
        <Icon name="vscode-icons:folder-type-git" />
        {{ repo }}
      </n-breadcrumb-item>
    </n-breadcrumb>

    <n-flex vertical>
      <h1>FAIR-BioRS Compliance Dashboard</h1>

      <p>
        This dashboard shows the compliance of the repository with the
        FAIR-BioRS principles. Any actions that you need to take on the
        repository will be shown here.
      </p>
    </n-flex>

    <n-alert v-if="botNotInstalled" type="error" class="my-5">
      The codefair bot is not installed on this repository. Please install the
      bot to view the compliance dashboard.
    </n-alert>

    <div v-else>
      <n-divider />

      <CardCollapsible
        title="License"
        subheader="The license for the repository is shown here. You can review open
          license requests and view closed license requests."
        class="rounded-lg bg-white shadow-md"
        bordered
      >
        <div class="my-3">
          <!-- <h3>Open License Requests</h3> -->

          <div
            v-for="licenseRequest in licenseRequests.open"
            :key="licenseRequest.identifier"
          >
            <n-card>
              <n-flex align="center" justify="space-between">
                <div>
                  <!-- <h3>{{ licenseRequest.identifier }}</h3> -->
                  <h3>ID: {{ generateSeed(licenseRequest.identifier) }}</h3>

                  <p>
                    {{
                      $dayjs
                        .unix(parseInt(licenseRequest.timestamp) / 1000)
                        .format("MMMM DD, YYYY HH:mmA")
                    }}
                  </p>
                </div>

                <NuxtLink
                  :to="`/add/license/${licenseRequest.identifier}`"
                  target="__blank"
                >
                  <n-button type="primary">View License</n-button>
                </NuxtLink>
              </n-flex>
            </n-card>
          </div>

          <!-- <n-divider />

          <h3>Closed License Requests</h3>

          <n-alert
            v-if="licenseRequests.closed.length === 0"
            type="info"
            class="my-5"
          >
            There are no closed license requests for this repository.
          </n-alert>

          <div
            v-for="licenseRequest in licenseRequests.closed"
            v-else
            :key="licenseRequest.identifier"
            :to="`/dashboard/${owner}/${repo}/license/${licenseRequest.identifier}`"
          >
            <n-card>
              <n-flex align="center" justify="space-between">
                <div>
                  <h3>{{ licenseRequest.identifier }}</h3>

                  <p>{{ licenseRequest.timestamp }}</p>
                </div>

                <NuxtLink :to="licenseRequest.pullRequest" target="__blank">
                  <n-button type="primary">View Pull Request</n-button>
                </NuxtLink>
              </n-flex>
            </n-card>
          </div> -->
        </div>
      </CardCollapsible>

      <n-divider />

      <CardCollapsible
        title="Code Metadata"
        subheader="The code metadata for the repository is shown here. This includes
            the number of files, the number of lines of code, and the number of
            commits."
        class="rounded-lg bg-white shadow-md"
        bordered
      >
        <!-- <h2>Code Metadata</h2> -->

        <div>
          <!-- <p>
            The code metadata for the repository is shown here. This includes
            the number of files, the number of lines of code, and the number of
            commits.
          </p> -->

          <n-alert v-if="!data?.codeMetadataRequest" type="info" class="my-5">
            There are no codemetadata requests for this repository yet.
          </n-alert>

          <n-card v-else class="my-3">
            <n-flex align="center" justify="space-between">
              <div>
                <h3>
                  ID: {{ generateSeed(data?.codeMetadataRequest.identifier) }}
                </h3>

                <p>
                  {{
                    $dayjs
                      .unix(
                        parseInt(data?.codeMetadataRequest.timestamp) / 1000,
                      )
                      .format("MMMM DD, YYYY HH:mmA")
                  }}
                </p>
              </div>

              <NuxtLink
                :to="`/add/code-metadata/${data?.codeMetadataRequest.identifier}`"
              >
                <n-button type="primary">View Code Metadata</n-button>
              </NuxtLink>
            </n-flex>
          </n-card>
        </div>
      </CardCollapsible>
    </div>

    <!-- <n-collapse class="mt-8">
      <n-collapse-item title="data" name="data">
        <pre>{{ data }}</pre>
      </n-collapse-item>
    </n-collapse> -->
  </main>
</template>
