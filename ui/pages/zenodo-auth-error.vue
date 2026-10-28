<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const reason = route.query.reason as string | undefined;

const reasonMessages: Record<string, string> = {
  incomplete_state:
    "The OAuth state was missing required fields (owner or repo).",
  invalid_state: "The OAuth state parameter could not be parsed.",
  invalid_token_response:
    "Zenodo's response did not include the expected access and refresh tokens.",
  missing_params:
    "The authorization code or state parameter was missing from the callback.",
  not_signed_in:
    "You were not signed in to Codefair when Zenodo sent you back. Sign in and try again.",
  oauth_paused:
    "Signing in with your Zenodo account is paused for maintenance.",
  state_expired:
    "This sign-in was started more than 30 minutes ago. Start again from the release page.",
  state_mismatch:
    "This sign-in was started by a different Codefair account. Start again from the release page while signed in to your own account.",
  token_exchange_error:
    "An unexpected error occurred while exchanging the authorization code.",
  token_exchange_failed: "Zenodo rejected the authorization code exchange.",
};

const reasonMessage = reason
  ? (reasonMessages[reason] ?? `Unknown error: ${reason}`)
  : null;

// The callback passes these along once it has read the OAuth state, so the
// user can go back and connect with a personal access token instead
const owner = route.query.owner as string | undefined;
const repo = route.query.repo as string | undefined;
const githubTag = (route.query.githubTag as string | undefined) ?? "";
const githubRelease = (route.query.githubRelease as string | undefined) ?? "";

const personalTokenLink = computed(() => {
  if (!owner || !repo) return null;

  // Opens the personal access token tab on the release page
  const params = new URLSearchParams({
    githubRelease,
    githubTag,
    zenodoSignIn: "token",
  });

  return `/dashboard/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/release/zenodo?${params.toString()}#zenodo-connection`;
});

// Failures caused by Zenodo's intermittent OAuth bug, which a retry often
// gets past. Other reasons need a fresh start from the release page.
const zenodoSideFailure = [
  "invalid_token_response",
  "token_exchange_error",
  "token_exchange_failed",
].includes(reason ?? "");
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

      <n-alert
        v-if="zenodoSideFailure"
        type="warning"
        title="This is a known Zenodo issue"
      >
        Zenodo sign-in currently fails at times, often on the first attempt,
        because of a bug on Zenodo's side. It's not caused by anything you did.
        We've reported it to Zenodo and they have scheduled a fix (<NuxtLink
          to="https://github.com/zenodo/zenodo-rdm/issues/1484"
          target="_blank"
          class="text-blue-500 underline transition-all hover:text-blue-700"
          >zenodo/zenodo-rdm#1484</NuxtLink
        >). Until then, you can try again or connect with a personal access
        token instead.
      </n-alert>

      <n-alert v-if="reasonMessage" type="error" title="Error details">
        {{ reasonMessage }}
      </n-alert>

      <div v-if="personalTokenLink" class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Connect with a personal access token
        </h2>

        <p class="text-sm text-gray-700 dark:text-gray-300">
          Create a token in your Zenodo account settings and paste it on the
          release page. It skips Zenodo sign-in entirely, so this error can't
          happen again.
        </p>

        <NuxtLink :to="personalTokenLink">
          <n-button type="primary" size="large" class="w-full">
            <template #icon>
              <Icon name="material-symbols:key" size="16" />
            </template>
            Connect with a personal access token instead
          </n-button>
        </NuxtLink>
      </div>

      <div v-if="zenodoSideFailure" class="flex flex-col gap-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Or try signing in again
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
        <n-button
          v-if="zenodoSideFailure"
          :type="personalTokenLink ? 'default' : 'primary'"
          size="large"
          @click="router.go(-1)"
        >
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
