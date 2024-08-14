<script setup lang="ts">
const route = useRoute();

const { owner } = route.params as { owner: string };

const botNotInstalled = ref(false);

const { data, error } = await useFetch(`/api/dashboard/${owner}`, {
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
</script>

<template>
  <main class="mx-auto max-w-screen-xl px-8 pb-8 pt-4">
    <n-breadcrumb class="pb-5">
      <n-breadcrumb-item :clickable="false">
        <Icon name="ri:dashboard-fill" />

        Dashboard
      </n-breadcrumb-item>

      <n-breadcrumb-item :clickable="false">
        <Icon name="uil:github" />
        {{ owner }}
      </n-breadcrumb-item>
    </n-breadcrumb>

    <n-flex vertical>
      <h1>Apps being managed by Codefair</h1>

      <n-divider />

      <n-flex vertical>
        <n-card
          v-for="repo in data"
          :key="repo.repositoryId"
          class="mt-2 rounded-lg shadow-md"
        >
          <n-flex align="center">
            <div class="flex-1">
              <n-flex align="center">
                <n-avatar
                  size="small"
                  :src="`https://api.dicebear.com/9.x/identicon/svg?seed=${repo.repositoryId}&backgroundColor=ffffff&bacgroundType=gradientLinear`"
                />

                <span class="text-lg font-medium">
                  {{ repo.repo }}
                </span>
              </n-flex>
            </div>

            <n-flex>
              <NuxtLink
                :href="`https://github.com/${owner}/${repo.repo}`"
                target="_blank"
              >
                <n-button secondary type="info">
                  <template #icon>
                    <Icon name="ri:github-fill" />
                  </template>
                  View on GitHub
                </n-button>
              </NuxtLink>

              <NuxtLink :to="`/dashboard/${owner}/${repo.repo}`">
                <n-button type="primary">
                  <template #icon>
                    <Icon name="ri:settings-4-fill" />
                  </template>

                  Manage FAIR Compliance
                </n-button>
              </NuxtLink>
            </n-flex>
          </n-flex>
        </n-card>
      </n-flex>
    </n-flex>

    <n-collapse class="mt-8">
      <n-collapse-item title="data" name="data">
        <pre>{{ data }}</pre>
      </n-collapse-item>
    </n-collapse>
  </main>
</template>
