<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const reason = route.query.reason as string | undefined;

const reasonMessages: Record<string, string> = {
  incomplete_state:
    "The OAuth state was missing required fields (user, owner, or repo).",
  invalid_state: "The OAuth state parameter could not be parsed.",
  missing_params:
    "The authorization code or state parameter was missing from the callback.",
  token_exchange_error:
    "An unexpected error occurred while exchanging the authorization code.",
  token_exchange_failed: "Zenodo rejected the authorization code exchange.",
};

const reasonMessage = reason
  ? (reasonMessages[reason] ?? `Unknown error: ${reason}`)
  : null;
</script>

<template>
  <main class="mx-auto max-w-screen-xl px-8 pb-8 pt-4">
    <div class="mx-auto flex max-w-xl flex-col gap-6 py-12">
      <div class="flex flex-col items-center gap-4 text-center">
        <Icon name="simple-icons:zenodo" size="48" class="text-gray-400" />

        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Zenodo Sign-In Didn't Complete
        </h1>
      </div>

      <n-alert type="warning" title="This is a known intermittent issue">
        Zenodo authentication occasionally fails on the first attempt. This is a
        known issue and we are currently working with the Zenodo team to resolve
        it. This is not caused by anything you did wrong.
      </n-alert>

      <n-alert v-if="reasonMessage" type="error" title="Error details">
        {{ reasonMessage }}
      </n-alert>

      <div class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          How to resolve this
        </h2>

        <ol
          class="list-inside list-decimal space-y-2 text-sm text-gray-700 dark:text-gray-300"
        >
          <li>
            Use your browser's <strong>Back</strong> button to return to the
            Zenodo authorization page.
          </li>

          <li>
            Approve access again (or, if Zenodo skips the approval screen, press
            <strong>Forward</strong> in your browser).
          </li>

          <li>
            If you end up on this page again, repeat the steps above. The issue
            is intermittent and typically resolves after one or two more
            attempts.
          </li>
        </ol>
      </div>

      <n-flex justify="center" class="gap-3 pt-2">
        <n-button type="primary" size="large" @click="router.go(-1)">
          <template #icon>
            <Icon name="mdi:arrow-left" size="16" />
          </template>
          Back to Zenodo Authorization
        </n-button>

        <n-button
          type="tertiary"
          size="large"
          @click="router.push('/dashboard')"
        >
          Go to Dashboard
        </n-button>
      </n-flex>
    </div>
  </main>
</template>
