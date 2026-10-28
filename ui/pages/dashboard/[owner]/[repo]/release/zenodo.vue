<script setup lang="ts">
import {
  type FormInst,
  type SelectOption,
  type SelectGroupOption,
  NTag,
} from "naive-ui";
import type { InputHTMLAttributes } from "vue";
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";
// import { faker } from "@faker-js/faker";

definePageMeta({
  middleware: ["protected"],
});

// const config = useRuntimeConfig();
// const codefairDomain = config.public.codefairDomain;

const route = useRoute();
const githubTag = route.query.githubTag;
const githubRelease = route.query.githubRelease;
const codefairDomain =
  typeof window !== "undefined" ? window.location.origin : "";

const user = useUser();
const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.showBreadcrumbs();
breadcrumbsStore.setFeature({
  id: "release-zenodo",
  name: "Zenodo",
  icon: "simple-icons:zenodo",
});

const { owner, repo } = route.params as { owner: string; repo: string };

const logwatch = useLogwatch();

const devMode = process.env.NODE_ENV === "development";

const zenodoOAuthSignIn = ref(false);
const haveValidZenodoToken = ref(false);
// Zenodo was down when the token was checked; the saved connection is kept.
const zenodoUnreachable = ref(false);
const zenodoTokenType = ref<"oauth" | "personal" | null>(null);
const zenodoTokenMessage = ref("");
const zenodoTokenSignIn = ref(true);

// Personal access token form, the workaround for Zenodo's intermittent OAuth
// failures (zenodo/zenodo-rdm#1484)
const zenodoPersonalToken = ref("");
const zenodoTokenConnecting = ref(false);
const zenodoTokenError = ref("");
// Keeps browsers and password managers from saving or filling in the token
const zenodoTokenInputProps = {
  autocomplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  spellcheck: "false",
} as InputHTMLAttributes;

const { messageFor: maintenanceMessageFor, zenodo: zenodoMaintenance } =
  useMaintenance();
// Both Zenodo sign-in switches paused: nobody can connect or publish
const zenodoPaused = computed(() => zenodoMaintenance.value.off !== null);

const licenseChecked = ref(false);
const metadataChecked = ref(false);
const license = ref({
  id: "",
  customLicenseTitle: "",
  status: "",
});

const selectedExistingDeposition = ref<string | null>(null);
const selectedDeposition = ref<string | null>(null);
const selectableDepositions = ref<Array<SelectOption | SelectGroupOption>>([]);
const zenodoEndpoint = ref("");

const selectedDepositionRecordUrl = computed(() => {
  if (!selectedDeposition.value || !zenodoEndpoint.value) return null;
  return `${zenodoEndpoint.value}/records/${selectedDeposition.value}`;
});

const zenodoFormIsValid = ref(false);
const zenodoFormRef = ref<FormInst | null>(null);
const zenodoFormValue = ref<ZenodoMetadata>({
  accessRight: null,
  version: "",
});
const zenodoFormRules = ref({
  accessRight: {
    message: "Please select an access right",
    required: true,
    trigger: ["blur", "input"],
  },
  version: {
    message: "Please input a version",
    required: true,
    trigger: ["blur", "input"],
  },
});

const githubFormIsValid = ref(false);
const githubFormRef = ref<FormInst | null>(null);
const githubFormValue = ref<{
  release: string | null;
  releaseTitle: string;
  tag: string | null;
  tagTitle: string;
}>({
  release: null,
  releaseTitle: "",
  tag: null,
  tagTitle: "",
});
const githubFormRules = ref({
  release: {
    message: "Please select a release",
    required: true,
    trigger: ["blur", "change"],
  },
  tag: {
    message: "Please select a tag",
    required: true,
    trigger: ["blur", "change"],
  },
});

const githubTagOptions = ref<Array<SelectOption | SelectGroupOption>>([]);
const githubReleaseOptions = ref<Array<SelectOption | SelectGroupOption>>([]);
const selectedGithubReleaseUrl = ref<string | null>(null);

const lastSelectedUser = ref<string | null>(null);
const lastSelectedGithubTag = ref<string | null>(null);
const lastSelectedGithubRelease = ref<number | null>(null);
const lastSelectedGithubReleaseTitle = ref<string | null>(null);

const zenodoDraftIsReadyForRelease = ref(false);
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

const setZenodoDepositions = (
  depositions: Array<{ id: number; title: string }>,
) => {
  selectableDepositions.value = depositions.map((deposition) => ({
    label: deposition.title,
    value: deposition.id.toString(),
  }));
};

const setZenodoConnection = (details: {
  haveValidZenodoToken: boolean;
  zenodoOAuthSignIn: boolean;
  zenodoTokenMessage: string;
  zenodoTokenSignIn: boolean;
  zenodoTokenType: "oauth" | "personal" | null;
  zenodoUnreachable: boolean;
}) => {
  zenodoOAuthSignIn.value = details.zenodoOAuthSignIn;
  haveValidZenodoToken.value = details.haveValidZenodoToken;
  zenodoTokenMessage.value = details.zenodoTokenMessage;
  zenodoTokenSignIn.value = details.zenodoTokenSignIn;
  zenodoTokenType.value = details.zenodoTokenType;
  zenodoUnreachable.value = details.zenodoUnreachable;
};

if (data.value) {
  setZenodoConnection(data.value);

  license.value.id = data.value?.license?.id || "";
  license.value.status = data.value?.license?.status || "";
  license.value.customLicenseTitle =
    data.value?.license?.customLicenseTitle || "";

  zenodoEndpoint.value = data.value.zenodoEndpoint || "";
  setZenodoDepositions(data.value.zenodoDepositions);

  lastSelectedUser.value = data.value.lastSelectedUser;
  lastSelectedGithubTag.value = data.value.lastSelectedGithubTag;
  lastSelectedGithubRelease.value = data.value.lastSelectedGithubRelease;
  lastSelectedGithubReleaseTitle.value =
    data.value.lastSelectedGithubReleaseTitle;

  // Build grouped release options: available drafts first, then already-released
  const draftReleases = data.value.githubReleases.filter((r) => r.draft);
  const publishedReleases = data.value.githubReleases.filter((r) => !r.draft);

  githubReleaseOptions.value = [
    { label: "I want to create a new release", value: "new" },
    ...(draftReleases.length
      ? [
          {
            children: draftReleases.map((r) => ({
              htmlUrl: r.htmlUrl,
              label: r.name || "Untitled release",
              prerelease: r.prerelease,
              value: r.id.toString(),
            })),
            key: "available",
            label: "Available (Draft)",
            type: "group" as const,
          },
        ]
      : []),
    ...(publishedReleases.length
      ? [
          {
            children: publishedReleases.map((r) => ({
              disabled: true,
              label: r.name || "Untitled release",
              prerelease: r.prerelease,
              value: r.id.toString(),
            })),
            key: "released",
            label: "Released",
            type: "group" as const,
          },
        ]
      : []),
  ];

  // Build grouped tag options: deduplicate by name, then split available vs released
  const seenTagNames = new Set<string>();
  const unreleasedTags: typeof data.value.githubTags = [];
  const releasedTags: typeof data.value.githubTags = [];

  for (const tag of data.value.githubTags) {
    if (seenTagNames.has(tag.name)) continue;
    seenTagNames.add(tag.name);
    if (tag.released) {
      releasedTags.push(tag);
    } else {
      unreleasedTags.push(tag);
    }
  }

  githubTagOptions.value = [
    { label: "I want to create a new tag", value: "new" },
    ...(unreleasedTags.length
      ? [
          {
            children: unreleasedTags.map((t) => ({
              label: t.name || "Untitled tag",
              value: t.name,
            })),
            key: "available",
            label: "Available",
            type: "group" as const,
          },
        ]
      : []),
    ...(releasedTags.length
      ? [
          {
            children: releasedTags.map((t) => ({
              disabled: true,
              label: t.name || "Untitled tag",
              value: t.name,
            })),
            key: "released",
            label: "Released",
            type: "group" as const,
          },
        ]
      : []),
  ];

  // dev
  // githubFormValue.value.tag = "new";
  // githubFormValue.value.tagTitle = `v${faker.system.semver()}`;
  // zenodoFormValue.value.version = githubFormValue.value.tagTitle;
  // githubTagOptions.value.push({
  //   disabled: false,
  //   label: githubFormValue.value.tag || "",
  //   value: githubFormValue.value.tag,
  // });

  // githubFormValue.value.release = "new";
  // githubFormValue.value.releaseTitle = faker.lorem.sentence();

  // slight hack but login step comes after the license and metadata checks.
  // The GitHub query params mean the user is coming back from that step,
  // including from a failed Zenodo sign-in on /zenodo-auth-error.
  if (haveValidZenodoToken.value || (githubTag && githubRelease)) {
    licenseChecked.value = true;
    metadataChecked.value = true;
  }
}

const allConfirmed = computed(
  () =>
    licenseChecked.value &&
    metadataChecked.value &&
    license.value?.id !== "Custom",
);

const createDraftGithubReleaseSpinner = ref(false);

const createDraftGithubRelease = () => {
  githubFormRef.value?.validate(async (errors) => {
    if (!errors) {
      createDraftGithubReleaseSpinner.value = true;
      await $fetch(`/api/${owner}/${repo}/release/github`, {
        body: JSON.stringify({
          title: githubFormValue.value.releaseTitle,
          release: githubFormValue.value.release,
          tag:
            githubFormValue.value.tag === "new"
              ? githubFormValue.value.tagTitle
              : githubFormValue.value.tag,
        }),
        headers: useRequestHeaders(["cookie"]),
        method: "POST",
      })
        .then((response) => {
          push.success({
            title: "Success",
            message: "Your draft GitHub release has been created.",
          });

          // Add the new release to the Available group (or create the group if absent)
          const releaseAvailGroup = githubReleaseOptions.value.find(
            (o) => (o as any).key === "available",
          ) as SelectGroupOption | undefined;
          const newReleaseOption = {
            htmlUrl: response.htmlUrl,
            label: githubFormValue.value.releaseTitle,
            value: response.releaseId.toString(),
          };
          if (releaseAvailGroup) {
            releaseAvailGroup.children = [
              ...(releaseAvailGroup.children ?? []),
              newReleaseOption,
            ];
          } else {
            githubReleaseOptions.value.splice(1, 0, {
              children: [newReleaseOption],
              key: "available",
              label: "Available (Draft)",
              type: "group",
            });
          }

          if (githubFormValue.value.tag === "new") {
            const tagAvailGroup = githubTagOptions.value.find(
              (o) => (o as any).key === "available",
            ) as SelectGroupOption | undefined;
            const newTagOption = {
              label: githubFormValue.value.tagTitle,
              value: githubFormValue.value.tagTitle,
            };
            if (tagAvailGroup) {
              tagAvailGroup.children = [
                ...(tagAvailGroup.children ?? []),
                newTagOption,
              ];
            } else {
              githubTagOptions.value.splice(1, 0, {
                children: [newTagOption],
                key: "available",
                label: "Available",
                type: "group",
              });
            }
          }

          // Select the new release
          githubFormValue.value.release = response.releaseId.toString();
          selectedGithubReleaseUrl.value = response.htmlUrl;

          const htmlUrl = response.htmlUrl;
          const editUrl = htmlUrl.replace("/tag/", "/edit/");

          window.open(editUrl, "_blank");
        })
        .catch((error) => {
          console.error("Failed to create draft GitHub release:", error);
          logwatch.error(
            "zenodo.createGithubRelease",
            "Failed to create draft GitHub release",
            { error, owner, repo },
          );
          push.error({
            title: "Failed to create draft GitHub release",
            message: "Please try again later",
          });
        })
        .finally(() => {
          createDraftGithubReleaseSpinner.value = false;
        });
    } else {
      console.warn("GitHub release form is invalid:", errors);
      logwatch.warn(
        "zenodo.validateGithubForm",
        "GitHub release form is invalid",
        { errors, owner, repo },
      );
    }
  });
};

const checkGithubReleaseSpinner = ref(false);
const githubReleaseIsDraft = ref(false);
const showGithubReleaseIsDraftStausBadge = ref(false);

// Set the initial values of the form if the query params are present
// Use explicit null/undefined checks — empty strings from the callback URL are valid falsy values
if (
  githubTag != null &&
  githubTag !== "" &&
  githubRelease != null &&
  githubRelease !== ""
) {
  githubFormValue.value.tag = githubTag.toString();
  githubFormValue.value.release = githubRelease.toString();
  zenodoDraftIsReadyForRelease.value = true;
  githubReleaseIsDraft.value = true;
  selectedGithubReleaseUrl.value =
    data.value?.githubReleases.find(
      (r) => r.id.toString() === githubRelease.toString(),
    )?.htmlUrl ?? null;
}

// The draft check polls every 3s, so only the first failure in a row for a
// release is forwarded to logwatch
let failingGithubReleaseCheck: string | null = null;

const checkIfGithubReleaseIsDraft = async () => {
  const releaseId = githubFormValue.value.release;

  if (!releaseId || releaseId === "new") {
    selectedGithubReleaseUrl.value = null;
    showGithubReleaseIsDraftStausBadge.value = false;
    // A check for the previous selection may still be running; it no longer
    // owns the spinner.
    checkGithubReleaseSpinner.value = false;
    return null;
  }

  checkGithubReleaseSpinner.value = true;

  return await $fetch(`/api/${owner}/${repo}/release/github/${releaseId}`, {
    headers: useRequestHeaders(["cookie"]),
    method: "GET",
  })
    .then((response) => {
      // Ignore responses for a release that is no longer selected
      if (githubFormValue.value.release !== releaseId) return;

      failingGithubReleaseCheck = null;

      if (response.draft) {
        githubReleaseIsDraft.value = true;
      } else {
        githubReleaseIsDraft.value = false;
      }
      selectedGithubReleaseUrl.value =
        response.htmlUrl ?? selectedGithubReleaseUrl.value;
      showGithubReleaseIsDraftStausBadge.value = true;
    })
    .catch((error) => {
      if (githubFormValue.value.release !== releaseId) return;

      githubReleaseIsDraft.value = false;
      showGithubReleaseIsDraftStausBadge.value = false;

      console.error("Failed to fetch GitHub release:", error);
      if (failingGithubReleaseCheck !== releaseId) {
        logwatch.error(
          "zenodo.checkGithubRelease",
          "Failed to fetch GitHub release",
          { error, owner, releaseId, repo },
        );
      }
      failingGithubReleaseCheck = releaseId;
    })
    .finally(() => {
      // A newer selection owns the spinner now.
      if (githubFormValue.value.release !== releaseId) return;
      checkGithubReleaseSpinner.value = false;
    });
};

const handleGithubReleaseChange = (
  _value: string | null,
  option: SelectOption | null,
) => {
  zenodoDraftIsReadyForRelease.value = false;
  zenodoPreflightError.value = null;
  githubFormValue.value.releaseTitle = "";
  selectedGithubReleaseUrl.value = (option?.htmlUrl as string) ?? null;
  checkIfGithubReleaseIsDraft();
};

const renderGithubReleaseLabel = (option: SelectOption): any => {
  return [
    option.prerelease &&
      h(
        NTag,
        {
          class: "mr-2",
          round: true,
          size: "small",
          type: "warning",
        },
        {
          default: () => "Prerelease",
        },
      ),
    // option.value === "new" &&
    //   h(
    //     NTag,
    //     {
    //       class: "mr-2",
    //       round: true,
    //       size: "small",
    //       type: "info",
    //     },
    //     {
    //       default: () => "New",
    //     },
    //   ),
    option.label as string,
  ];
};

const tagNameConflict = computed(() => {
  if (githubFormValue.value.tag !== "new" || !githubFormValue.value.tagTitle)
    return false;
  return (
    data.value?.githubTags?.some(
      (t: any) => t.name === githubFormValue.value.tagTitle,
    ) ?? false
  );
});

const handleGithubTagChange = () => {
  zenodoDraftIsReadyForRelease.value = false;
  zenodoPreflightError.value = null;
  githubFormValue.value.tagTitle = "";
  checkIfGithubReleaseIsDraft();
};

const zenodoPublishSpinner = ref(false);
const zenodoDraftSpinner = ref(false);

const showZenodoPublishProgressModal = ref(false);
const zenodoPublishStatus = ref<string>("");
const zenodoPublishDOI = ref<string>("");
// Captured at publish time because resetForm() clears the form on success
const zenodoPublishTag = ref<string>("");
const zenodoPublishErrorMessage = ref<string>("");
const zenodoBadgeShield = ref<string>("");
const zenodoPreflightError = ref<string | null>(null);
const showZenodoBadgeModal = ref(false);

interface PublishStep {
  key: string;
  label: string;
  message: string;
  status: "pending" | "in_progress" | "completed" | "error";
  upload?: ZenodoUploadProgress;
}

const publishSteps = ref<PublishStep[]>([
  {
    key: "metadata",
    label: "Prepare metadata",
    message: "",
    status: "pending",
  },
  {
    key: "deposition",
    label: "Prepare Zenodo record draft",
    message: "",
    status: "pending",
  },
  {
    key: "upload_metadata",
    label: "Upload metadata to Zenodo",
    message: "",
    status: "pending",
  },
  {
    key: "update_repo",
    label: "Commit DOI files to repository",
    message: "",
    status: "pending",
  },
  {
    key: "upload_files",
    label: "Upload release files to Zenodo",
    message: "",
    status: "pending",
  },
  {
    key: "publish",
    label: "Publish Zenodo record",
    message: "",
    status: "pending",
  },
]);

const resetPublishSteps = () => {
  for (const step of publishSteps.value) {
    step.status = "pending";
    step.message = "";
    step.upload = undefined;
  }
  zenodoPublishErrorMessage.value = "";
};

// Flags the file that was in flight when its step failed.
const failActiveUpload = (step: PublishStep) => {
  const active = step.upload?.files.find(
    (file) => file.status !== "pending" && file.status !== "completed",
  );
  if (active) active.status = "error";
};

const applyUploadUpdate = (step: PublishStep, update: ZenodoUploadUpdate) => {
  if (update.type === "list") {
    step.upload = { files: update.files, maxAttempts: update.maxAttempts };
  } else if (step.upload) {
    step.upload.files[update.index] = update.file;
  }
};

const resetForm = () => {
  githubFormValue.value = {
    release: null,
    releaseTitle: "",
    tag: null,
    tagTitle: "",
  };
  zenodoFormValue.value = { accessRight: null, version: "" };
  zenodoDraftIsReadyForRelease.value = false;
  githubReleaseIsDraft.value = false;
  selectedGithubReleaseUrl.value = null;
  showGithubReleaseIsDraftStausBadge.value = false;
  zenodoPreflightError.value = null;
  useRouter().replace({ query: {} });
};

const handleSSEEvent = (event: {
  data?: { doi: string; htmlUrl: string };
  message: string;
  status: string;
  step: string;
  upload?: ZenodoUploadUpdate;
}) => {
  if (event.step === "complete") {
    zenodoPublishStatus.value = "published";
    if (event.data?.doi) {
      zenodoPublishDOI.value = event.data.doi;
    }
    for (const step of publishSteps.value) {
      if (step.status !== "error") {
        step.status = "completed";
      }
    }
    resetForm();
    return;
  }

  if (event.step === "error") {
    zenodoPublishStatus.value = "error";
    zenodoPublishErrorMessage.value = event.message;
    const inProgress = publishSteps.value.find(
      (s) => s.status === "in_progress",
    );
    if (inProgress) {
      inProgress.status = "error";
      inProgress.message = event.message;
      failActiveUpload(inProgress);
    }
    return;
  }

  const step = publishSteps.value.find((s) => s.key === event.step);
  if (!step) return;

  step.message = event.message;
  if (event.upload) applyUploadUpdate(step, event.upload);
  if (event.status === "in_progress") {
    step.status = "in_progress";
  } else if (event.status === "completed") {
    step.status = "completed";
  } else if (event.status === "error") {
    step.status = "error";
    failActiveUpload(step);
    zenodoPublishStatus.value = "error";
    zenodoPublishErrorMessage.value = event.message;
  }
};

const navigateToDashboard = async () => {
  await navigateTo(`/dashboard/${owner}/${repo}/`);
};

const startZenodoPublishProcess = async (shouldPublish: boolean = false) => {
  if (shouldPublish) {
    zenodoPublishSpinner.value = true;
  } else {
    zenodoDraftSpinner.value = true;
  }

  const effectiveTag =
    githubFormValue.value.tag !== "new"
      ? githubFormValue.value.tag
      : githubFormValue.value.tagTitle;

  const body = JSON.stringify({
    metadata: zenodoFormValue.value,
    publish: shouldPublish,
    release: githubFormValue.value.release,
    tag: effectiveTag,
    useExistingDeposition: selectedExistingDeposition.value === "existing",
    zenodoDepositionId:
      selectedExistingDeposition.value === "existing"
        ? selectedDeposition.value?.toString()
        : "",
  });

  zenodoPreflightError.value = null;

  try {
    const response = await fetch(`/api/${owner}/${repo}/release/zenodo`, {
      body,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      let statusMessage = "";
      try {
        const errBody = await response.json();
        statusMessage = errBody.statusMessage ?? "";
      } catch {
        // ignore parse errors
      }
      const knownErrors: Record<string, string> = {
        "GitHub release is not a draft":
          "The selected GitHub release is no longer a draft and cannot be used. Please select a different release.",
        "GitHub release not found":
          "The selected GitHub release could not be found. Please refresh the page and try again.",
        "publish-in-progress":
          "A Zenodo publication is already running for this repository. Please wait for it to finish, then refresh the page.",
        "tag-already-released": `A published release already exists for tag "${effectiveTag}". Please choose a different tag or delete the existing release first.`,
        "Zenodo token not found":
          "Your Zenodo connection has expired or been revoked. Please reconnect your Zenodo account above.",
        "zenodo-unreachable":
          "Zenodo could not be reached. Your Zenodo connection is still saved, so please try again in a few minutes.",
      };
      // Other 503s carry a message written for users, such as a
      // maintenance pause
      zenodoPreflightError.value =
        knownErrors[statusMessage] ??
        (response.status === 503 && statusMessage
          ? statusMessage
          : `Something went wrong (${response.status}). Please try again.`);
      return;
    }

    if (githubFormValue.value.tag === "new") {
      const tagAvailGroup = githubTagOptions.value.find(
        (o) => (o as any).key === "available",
      ) as SelectGroupOption | undefined;
      const newTagOption = {
        label: githubFormValue.value.tagTitle,
        value: githubFormValue.value.tagTitle,
      };
      if (tagAvailGroup) {
        tagAvailGroup.children = [
          ...(tagAvailGroup.children ?? []),
          newTagOption,
        ];
      } else {
        githubTagOptions.value.splice(1, 0, {
          children: [newTagOption],
          key: "available",
          label: "Available",
          type: "group",
        });
      }
      githubFormValue.value.tag = githubFormValue.value.tagTitle;
      githubFormValue.value.tagTitle = "";
    }

    if (!shouldPublish) {
      push.success({
        title: "Success",
        message: "Your Zenodo draft has been saved.",
      });
      return;
    }

    // Open the progress modal and reset steps before streaming begins
    showZenodoPublishProgressModal.value = true;
    zenodoPublishStatus.value = "inProgress";
    zenodoPublishTag.value = effectiveTag ?? "";
    resetPublishSteps();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6));
            handleSSEEvent(event);
          } catch {
            // ignore malformed lines
          }
        }
      }
    }
  } catch (error) {
    console.error("Failed to start Zenodo publish process:", error);
    logwatch.error("zenodo.publish", "Failed to start Zenodo publish process", {
      error,
      owner,
      repo,
    });
    push.error({
      title: "Failed to start Zenodo publish process",
      message: "Please try again later",
    });
    zenodoPublishStatus.value = "error";
  } finally {
    zenodoPublishSpinner.value = false;
    zenodoDraftSpinner.value = false;
    fetchZenodoBadge();
  }
};

const requestZenodoBadge = () => {
  fetchZenodoBadge();
  showZenodoBadgeModal.value = true;
};

const copyText = (text: string) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      push.success({
        title: "Success",
        message: "Text copied to clipboard",
      });
    })
    .catch((err) => {
      console.error("Failed to copy text: ", err);
      logwatch.error("zenodo.copyText", "Failed to copy text", {
        error: err,
        owner,
        repo,
      });
    });
};

function zenodoDoiUrl(doi: string): string {
  // Sandbox DOIs use the 10.5072 prefix and must be resolved via sandbox.zenodo.org
  const base = doi.startsWith("10.5072")
    ? "https://sandbox.zenodo.org/doi"
    : "https://doi.org";
  return `${base}/${doi}`;
}

const zenodoDepositionUrl = computed(() => {
  if (!zenodoPublishDOI.value) return "";
  return zenodoDoiUrl(zenodoPublishDOI.value);
});

const githubReleaseUrl = computed(
  () =>
    `https://github.com/${owner}/${repo}/releases/tag/${zenodoPublishTag.value}`,
);

const fetchZenodoBadge = () => {
  zenodoBadgeShield.value = "";
  $fetch(`/api/badge/${owner}/${repo}`, {
    headers: useRequestHeaders(["cookie"]),
    method: "GET",
    responseType: "text",
  })
    .then((badge) => {
      if (badge) {
        // Provide a modal to show the badge
        zenodoBadgeShield.value = badge;
      }
    })
    .catch((error) => {
      console.error("Error fetching badge:", error);
      logwatch.error("zenodo.fetchBadge", "Error fetching badge", {
        error,
        owner,
        repo,
      });
    });
};

const validateZenodoForm = () => {
  zenodoFormRef.value?.validate((errors) => {
    if (!errors) {
      // Check if the selected zenodo deposition is an actual option'
      if (selectedExistingDeposition.value !== "new") {
        if (
          selectableDepositions.value.find(
            (item) => item.value === selectedDeposition.value?.toString(),
          )
        ) {
          // do nothing
        } else {
          zenodoFormIsValid.value = false;
          push.error({
            title: "Error",
            message: "Please select a valid Zenodo deposition.",
          });
          return;
        }
      }

      zenodoFormIsValid.value = true;

      push.success({
        title: "Success",
        message: "Your Zenodo metadata has been validated.",
      });
    } else {
      console.warn("Zenodo metadata form is invalid:", errors);
      logwatch.warn(
        "zenodo.validateMetadata",
        "Zenodo metadata form is invalid",
        { errors, owner, repo },
      );

      push.error({
        title: "Error",
        message: "Your Zenodo metadata could not be validated.",
      });

      zenodoFormIsValid.value = false;
    }
  });
};

// Zenodo builds this page on whichever site is configured, sandbox or production
const zenodoNewTokenUrl = computed(
  () =>
    `${zenodoEndpoint.value || "https://zenodo.org"}/account/settings/applications/tokens/new/`,
);

const refreshZenodoConnection = async () => {
  const latest = await $fetch(`/api/${owner}/${repo}/release/zenodo`, {
    headers: useRequestHeaders(["cookie"]),
  });

  setZenodoConnection(latest);
  setZenodoDepositions(latest.zenodoDepositions);
};

const connectZenodoWithToken = async () => {
  const token = zenodoPersonalToken.value.trim();
  if (!token || zenodoTokenConnecting.value) return;

  zenodoTokenConnecting.value = true;
  zenodoTokenError.value = "";

  try {
    await $fetch("/api/zenodo/token", {
      body: { token },
      headers: useRequestHeaders(["cookie"]),
      method: "POST",
    });

    // Cleared as soon as it is stored so the page holds no copy of it
    zenodoPersonalToken.value = "";

    await refreshZenodoConnection();

    push.success({
      title: "Connected to Zenodo",
      message: "Your personal access token was accepted.",
    });
  } catch (error: any) {
    // Only the status is logged: the request body holds the token
    console.error(
      "Failed to connect Zenodo with a personal access token:",
      error?.statusCode,
    );
    logwatch.error(
      "zenodo.connectToken",
      "Failed to connect Zenodo with a personal access token",
      { owner, repo, statusCode: error?.statusCode },
    );
    zenodoTokenError.value =
      error?.data?.statusMessage ??
      "Could not connect to Zenodo. Please try again.";
  } finally {
    zenodoTokenConnecting.value = false;
  }
};

const signOutOfZenodo = async () => {
  const wasPersonalToken = zenodoTokenType.value === "personal";

  await $fetch(`/api/zenodo/disconnect`, {
    headers: useRequestHeaders(["cookie"]),
    method: "POST",
  })
    .then(() => {
      haveValidZenodoToken.value = false;
      zenodoTokenType.value = null;
      zenodoTokenMessage.value = "";
      push.success({
        title: "Disconnected from Zenodo",
        message: wasPersonalToken
          ? "To revoke access completely, also delete the token in your Zenodo account settings under Applications."
          : "You have been disconnected from Zenodo.",
      });
    })
    .catch((error) => {
      console.error("Failed to sign out of Zenodo:", error);
      logwatch.error("zenodo.signOut", "Failed to sign out of Zenodo", {
        error,
        owner,
        repo,
      });
      push.error({
        title: "Failed to sign out of Zenodo",
        message: "Please try again later",
      });
    });
};

const loginToZenodo = async () => {
  try {
    // Purge the stored Zenodo token before signing in again
    await $fetch(`/api/zenodo/disconnect`, {
      headers: useRequestHeaders(["cookie"]),
      method: "POST",
    });

    // The server signs the sign-in for this account and returns the Zenodo
    // URL to continue at
    const { url } = await $fetch("/api/zenodo/login", {
      body: {
        githubRelease: githubFormValue.value.release ?? "",
        githubTag:
          (githubFormValue.value.tag === "new"
            ? githubFormValue.value.tagTitle
            : githubFormValue.value.tag) ?? "",
        owner,
        repo,
      },
      headers: useRequestHeaders(["cookie"]),
      method: "POST",
    });

    window.location.href = url;
  } catch (error: any) {
    console.error("Failed to start Zenodo sign-in:", error);
    logwatch.error("zenodo.login", "Failed to start Zenodo sign-in", {
      error,
      owner,
      repo,
    });
    push.error({
      title: "Could not start Zenodo sign-in",
      message: error?.data?.statusMessage ?? "Please try again later",
    });
  }
};

const githubReleaseInterval = ref<any>(null);

const snippets = computed(() => [
  {
    title: "Markdown",
    content: `[![FAIR Software Release](${codefairDomain}/badge/${owner}/${repo})](${codefairDomain}/badge/${owner}/${repo})`,
  },
  {
    title: "HTML",
    content: `<a href="${codefairDomain}/badge/${owner}/${repo}"><img src="${codefairDomain}/badge/${owner}/${repo}" alt="FAIR Software Release"></a>`,
  },
  {
    title: "Image & Target URL",
    items: [
      {
        content: `${codefairDomain}/badge/${owner}/${repo}`,
        label: "Image URL",
      },
      {
        content: `${codefairDomain}/doi/${owner}/${repo}`,
        label: "Target URL",
      },
    ],
  },
]);

onMounted(() => {
  // if there are items in the zenodoMetadata object, validate the zenodoForm
  if (
    data.value?.zenodoMetadata &&
    Object.keys(data.value.zenodoMetadata).length > 0
  ) {
    validateZenodoForm();
  }

  // check if the github release is a draft in a 1sec interval
  githubReleaseInterval.value = setInterval(async () => {
    await checkIfGithubReleaseIsDraft();
  }, 3000);
});

onBeforeUnmount(() => {
  clearInterval(githubReleaseInterval.value);
});
</script>

<template>
  <main class="mx-auto max-w-screen-xl px-8 pb-8 pt-4">
    <n-flex vertical>
      <div class="flex flex-row items-center justify-between">
        <h1>FAIR Software Release</h1>

        <!-- <n-button
          type="primary"
          class="flex items-center"
          @click="requestZenodoBadge"
          >Request Zenodo badge</n-button
        > -->

        <NuxtLink
          to="https://docs.codefair.io/docs/archive.html"
          target="_blank"
          class="text-blue-400 underline transition-all hover:text-blue-500"
          >Need help?</NuxtLink
        >
      </div>

      <MaintenanceNotice maintenance-key="zenodo" />

      <p>
        Create a release of your repository on Zenodo. We will also create a
        Github release and update all referencing DOIs to point to the Zenodo
        release.
      </p>
    </n-flex>

    <n-divider />

    <n-flex vertical>
      <n-alert
        v-if="
          lastSelectedUser &&
          lastSelectedGithubTag &&
          lastSelectedGithubRelease &&
          data?.zenodoWorkflowStatus !== 'published'
        "
        :type="user?.username === lastSelectedUser ? 'info' : 'warning'"
        class="w-full"
      >
        A Zenodo release was last configured for this repository by
        <NuxtLink
          :to="`https://github.com/${lastSelectedUser}`"
          target="_blank"
          class="text-blue-500 underline transition-all hover:text-blue-700"
        >
          {{ lastSelectedUser }}</NuxtLink
        >
        The selected tag was
        <code>{{ lastSelectedGithubTag }}</code>

        and the selected release was titled
        <code>{{ lastSelectedGithubReleaseTitle || "Untitled" }}</code>

        .
      </n-alert>

      <n-alert
        v-if="data?.lastPublishedZenodoDoi"
        type="success"
        class="w-full"
      >
        <n-flex justify="space-between">
          <div>
            This repository was last released on Zenodo at
            <NuxtLink
              :to="zenodoDoiUrl(data!.lastPublishedZenodoDoi)"
              target="_blank"
              class="text-blue-500 underline transition-all hover:text-blue-700"
              >{{ data?.lastPublishedZenodoDoi }} </NuxtLink
            >.
          </div>

          <n-button
            type="info"
            class="flex h-6 items-center"
            @click="requestZenodoBadge"
            >Request Zenodo badge</n-button
          >
        </n-flex>
      </n-alert>

      <n-alert
        v-if="data?.lastPublishedZenodoDoi === 'inProgress'"
        type="info"
        class="w-full"
      >
        Zenodo is currently publishing this repository. You can check the status
        of the Zenodo deposition on the dashboard.
      </n-alert>

      <n-alert
        v-if="data?.lastPublishedZenodoDoi === 'error'"
        type="error"
        class="w-full"
      >
        There was an error with publishing this repository to Zenodo. Please try
        again later or contact the Codefair team for assistance.
      </n-alert>
    </n-flex>

    <h2 class="py-6">Required metadata files</h2>

    <n-flex vertical class="mb-4">
      <CardDashboard
        title="Confirm License"
        subheader="A license file is required for the repository to be released on Zenodo."
      >
        <template #icon>
          <Icon name="material-symbols:license" size="40" />
        </template>

        <template #content>
          <div class="flex w-full flex-col space-y-3">
            <n-flex
              v-if="license.id && license.customLicenseTitle != ''"
              class="border p-2 dark:bg-indigo-300 dark:text-black"
              align="center"
            >
              <Icon name="tabler:license" size="24" />

              <p class="text-sm">
                The license file was identified as `{{ license.id }}` with a
                title of `{{ license.customLicenseTitle }}`
              </p>
            </n-flex>

            <n-flex
              v-if="license.id && license.id !== 'Custom'"
              class="border bg-indigo-200 p-2 dark:bg-indigo-300 dark:text-black"
              align="center"
            >
              <Icon name="tabler:license" size="24" />

              <p class="text-sm">
                The license file was identified as `{{ license.id }}`
              </p>
            </n-flex>

            <n-alert
              v-if="license.id === 'Custom' && !license?.customLicenseTitle"
              type="error"
              class="mb-4 w-full"
            >
              Zenodo requires a license title for custom licenses. Please enter
              a custom license title in the License section.
            </n-alert>

            <n-alert
              v-if="license.status === 'invalid'"
              type="warning"
              class="mb-4 w-full"
            >
              Please verify that the license file is valid and contains the
              required information.
            </n-alert>

            <n-alert
              v-if="license.id === 'Custom'"
              type="error"
              class="mb-4 w-full"
            >
              This workflow is not currently supported for custom licenses. We
              recommend using a license that is within the list of SPDX
              licenses.
            </n-alert>

            <n-checkbox
              :checked="licenseChecked && license.id !== 'Custom'"
              :disabled="license.id === 'Custom'"
              @update:checked="(val: any) => (licenseChecked = val)"
            >
              <span class="text-gray-800 dark:text-gray-200">
                I have added and reviewed the license file that is required for
                the repository to be released on Zenodo.
              </span>
            </n-checkbox>
          </div>
        </template>

        <template #header-extra>
          <a :href="`/dashboard/${owner}/${repo}/edit/license`">
            <n-button type="primary">
              <template #icon>
                <Icon name="akar-icons:edit" size="16" />
              </template>
              Review license
            </n-button>
          </a>
        </template>
      </CardDashboard>

      <CardDashboard
        title="Confirm metadata"
        subheader="A code metadata file is required for the repository to be released on Zenodo."
      >
        <template #icon>
          <Icon name="tabler:code" size="40" />
        </template>

        <template #content>
          <div class="flex w-full flex-col space-y-4">
            <p class="w-full text-base">
              Your codemeta.json file is used to generate the title,
              description, and metadata of your Zenodo deposition. Please make
              sure that the content of this file is correct and up-to-date.
            </p>

            <p class="w-full text-base">
              Codefair will automatically add/update the version number, last
              modified date, and software identifier before the release so you
              do not need to worry about them.
            </p>

            <n-checkbox v-model:checked="metadataChecked">
              <span class="text-gray-800 dark:text-gray-200">
                I have added and reviewed the <code> citation.CFF </code>
                and
                <code> codemeta.json </code>
                files. I have verified that the content of these files are
                correct and up-to-date.
              </span>
            </n-checkbox>
          </div>
        </template>

        <template #header-extra>
          <a :href="`/dashboard/${owner}/${repo}/edit/code-metadata`">
            <n-button type="primary">
              <template #icon>
                <Icon name="akar-icons:edit" size="16" />
              </template>
              Review code metadata
            </n-button>
          </a>
        </template>
      </CardDashboard>

      <div v-if="allConfirmed">
        <n-divider />

        <h2 class="pb-6">GitHub release</h2>

        <CardDashboard title="Draft a GitHub release">
          <template #icon>
            <Icon name="lucide:folder-git-2" size="40" />
          </template>

          <template #header-extra>
            <div v-if="showGithubReleaseIsDraftStausBadge">
              <n-tag
                v-if="githubReleaseIsDraft"
                type="success"
                size="small"
                class="dark:bg-green-100 dark:text-green-600"
              >
                Github release is in draft state
                <template #icon>
                  <Icon
                    v-if="checkGithubReleaseSpinner"
                    name="icon-park-twotone:loading-three"
                    size="16"
                  />

                  <Icon v-else name="icon-park-twotone:check-one" size="16" />
                </template>
              </n-tag>

              <n-tag
                v-else
                type="error"
                size="small"
                class="dark:bg-red-100 dark:text-red-600"
              >
                Github release is not in draft state
                <template #icon>
                  <Icon
                    v-if="checkGithubReleaseSpinner"
                    name="icon-park-twotone:loading-three"
                    size="16"
                  />

                  <Icon v-else name="ic:round-warning" size="16" />
                </template>
              </n-tag>
            </div>
          </template>

          <template #content>
            <div class="flex w-full flex-col">
              <n-form
                ref="githubFormRef"
                :label-width="80"
                :model="githubFormValue"
                :rules="githubFormRules"
                size="large"
              >
                <n-form-item label="Github tag" path="tag">
                  <n-select
                    v-model:value="githubFormValue.tag"
                    :options="githubTagOptions"
                    filterable
                    clearable
                    placeholder="Type or select a tag"
                    @update:value="handleGithubTagChange"
                  />
                </n-form-item>

                <n-form-item
                  v-show="githubFormValue.tag === 'new'"
                  label="Tag name"
                  path="tagTitle"
                  :rule="{
                    message: 'Please enter a tag name',
                    required: githubFormValue.tag === 'new',
                    trigger: ['blur', 'input'],
                  }"
                >
                  <n-input
                    v-model:value="githubFormValue.tagTitle"
                    clearable
                    placeholder="v1.0.0"
                  />
                </n-form-item>

                <n-alert
                  v-if="tagNameConflict"
                  type="error"
                  class="mb-4 w-full"
                >
                  A tag named
                  <code>{{ githubFormValue.tagTitle }}</code> already exists.
                  Please choose a different tag name or select the existing tag
                  from the list above.
                </n-alert>

                <n-form-item label="Github release" path="release">
                  <n-select
                    v-model:value="githubFormValue.release"
                    :options="githubReleaseOptions"
                    placeholder="Select a release"
                    clearable
                    filterable
                    :loading="checkGithubReleaseSpinner"
                    :render-label="renderGithubReleaseLabel"
                    @update:value="handleGithubReleaseChange"
                  />
                </n-form-item>

                <div
                  v-if="selectedGithubReleaseUrl"
                  class="mb-4 flex items-center gap-2 text-sm"
                >
                  <Icon name="simple-icons:github" size="16" class="shrink-0" />

                  <span class="shrink-0 text-gray-600 dark:text-gray-400"
                    >View on GitHub:</span
                  >

                  <NuxtLink
                    :to="selectedGithubReleaseUrl"
                    target="_blank"
                    class="break-all text-blue-500 underline transition-all hover:text-blue-700"
                  >
                    {{ selectedGithubReleaseUrl }}
                  </NuxtLink>
                </div>

                <n-form-item
                  v-show="githubFormValue.release === 'new'"
                  label="Release title"
                  path="releaseTitle"
                  :rule="{
                    message: 'Please enter a title',
                    required: githubFormValue.release === 'new',
                    trigger: ['blur', 'input'],
                  }"
                >
                  <n-input
                    v-model:value="githubFormValue.releaseTitle"
                    clearable
                    placeholder="My awesome release title"
                  />
                </n-form-item>

                <div
                  v-if="
                    githubFormValue.release &&
                    githubFormValue.tag &&
                    githubFormValue.release !== 'new'
                  "
                  class="flex w-full flex-col space-y-4"
                >
                  <n-alert type="info" class="w-full">
                    Please add any additional executables to your GitHub release
                    and also update the release notes. Once you are done, you
                    can come back to this page.
                  </n-alert>

                  <n-alert type="warning" class="w-full">
                    Do not publish your Github release yet. We will handle this
                    step for you.
                  </n-alert>

                  <n-button
                    v-if="!zenodoDraftIsReadyForRelease"
                    type="primary"
                    :disabled="!githubReleaseIsDraft"
                    @click="zenodoDraftIsReadyForRelease = true"
                  >
                    <template #icon>
                      <Icon name="basil:play-solid" size="16" />
                    </template>
                    My draft is ready for release
                  </n-button>
                </div>

                <div
                  v-if="
                    githubFormValue.release === 'new' &&
                    githubFormValue.releaseTitle !== ''
                  "
                  class="flex w-full flex-col space-y-4"
                >
                  <n-alert type="info" class="w-full">
                    Your GitHub release will be created in a draft state. Please
                    make sure to add any additional executables and update the
                    release notes. Once you are done, you can come back to this
                    page.
                  </n-alert>

                  <n-alert type="warning" class="w-full">
                    Do not publish your Github release yet. We will handle this
                    step for you.
                  </n-alert>

                  <n-button
                    :loading="createDraftGithubReleaseSpinner"
                    type="primary"
                    @click="createDraftGithubRelease"
                  >
                    <template #icon>
                      <Icon name="fa:plus" size="16" />
                    </template>
                    Create draft GitHub release
                  </n-button>
                </div>
              </n-form>
            </div>
          </template>
        </CardDashboard>
      </div>
    </n-flex>

    <div v-if="githubReleaseIsDraft && zenodoDraftIsReadyForRelease">
      <n-divider />

      <h2 class="pb-6">Zenodo deposition</h2>

      <CardDashboard id="zenodo-connection" title="Check Zenodo connection">
        <template #icon>
          <Icon
            v-if="zenodoUnreachable"
            name="ic:round-warning"
            size="40"
            class="text-amber-500"
          />

          <Icon
            v-else-if="!haveValidZenodoToken"
            name="clarity:disconnect-line"
            size="40"
            class="text-red-500"
          />

          <Icon v-else name="wpf:connected" size="40" />
        </template>

        <template #content>
          <n-flex
            v-if="haveValidZenodoToken"
            justify="space-between"
            class="w-full"
            align="center"
          >
            <p>
              {{
                zenodoTokenType === "personal"
                  ? "Connected to Zenodo with a personal access token."
                  : "Connected to your Zenodo account."
              }}
              You can now continue to the next step.
            </p>

            <n-button type="primary" @click="signOutOfZenodo">
              <template #icon>
                <Icon name="material-symbols:logout" size="16" />
              </template>
              Disconnect
            </n-button>
          </n-flex>

          <n-flex
            v-else-if="zenodoUnreachable"
            justify="space-between"
            class="w-full"
            align="center"
          >
            <p>
              We couldn't reach Zenodo to check your connection. Your connection
              is still saved, so please try again in a few minutes.
            </p>

            <n-button type="primary" @click="reloadNuxtApp()">
              <template #icon>
                <Icon name="mdi:refresh" size="16" />
              </template>
              Try again
            </n-button>
          </n-flex>

          <n-flex v-else vertical size="large" class="w-full">
            <n-alert v-if="zenodoTokenMessage" type="warning">
              {{ zenodoTokenMessage }}
            </n-alert>

            <n-alert
              v-if="zenodoPaused"
              type="warning"
              title="Connecting to Zenodo is paused"
            >
              {{ zenodoMaintenance.off?.message }}
            </n-alert>

            <template v-else>
              <n-flex
                v-if="zenodoOAuthSignIn"
                justify="space-between"
                align="center"
              >
                <p>
                  Connect your Zenodo account to continue. Zenodo sign-in may
                  currently need more than one attempt because of a
                  <NuxtLink
                    to="https://github.com/zenodo/zenodo-rdm/issues/1484"
                    target="_blank"
                    class="text-blue-500 underline transition-all hover:text-blue-700"
                    >known Zenodo issue</NuxtLink
                  >.
                </p>

                <a @click="loginToZenodo">
                  <n-button type="primary">
                    <template #icon>
                      <Icon name="simple-icons:zenodo" size="16" />
                    </template>
                    Login to Zenodo
                  </n-button>
                </a>
              </n-flex>

              <div
                v-if="zenodoTokenSignIn"
                :class="{
                  'border-t border-slate-200 pt-4 dark:border-slate-700':
                    zenodoOAuthSignIn,
                }"
              >
                <h3 class="pb-2 text-lg font-semibold">
                  {{
                    zenodoOAuthSignIn
                      ? "Or connect with a personal access token"
                      : "Connect with a personal access token"
                  }}
                </h3>

                <p v-if="!zenodoOAuthSignIn" class="pb-2">
                  {{ maintenanceMessageFor("zenodoOAuth") }}
                  Connect your Zenodo account with a personal access token
                  instead.
                </p>

                <ol class="list-inside list-decimal space-y-1 pb-4 text-sm">
                  <li>
                    Sign in to Zenodo, or create a free account first if you
                    don't have one.
                  </li>

                  <li>
                    Open the
                    <NuxtLink
                      :to="zenodoNewTokenUrl"
                      target="_blank"
                      class="text-blue-500 underline hover:text-blue-600"
                      >new personal access token page</NuxtLink
                    >
                    (Account settings, then Applications, then New token).
                  </li>

                  <li>
                    Give it a name like <strong>Codefair</strong>
                    and tick both
                    <strong>deposit:write</strong>
                    and
                    <strong>deposit:actions</strong>. You can leave user:email
                    unticked.
                  </li>

                  <li>
                    Click <strong>Create</strong>, then copy the token and paste
                    it below. Zenodo only shows it once.
                  </li>
                </ol>

                <n-form-item
                  label="Personal access token"
                  :show-feedback="false"
                >
                  <n-flex :wrap="false" class="w-full max-w-xl">
                    <n-input
                      v-model:value="zenodoPersonalToken"
                      type="password"
                      show-password-on="click"
                      placeholder="Paste your token"
                      autocomplete="off"
                      :input-props="zenodoTokenInputProps"
                      @keyup.enter="connectZenodoWithToken"
                    />

                    <n-button
                      type="primary"
                      :disabled="!zenodoPersonalToken.trim()"
                      :loading="zenodoTokenConnecting"
                      @click="connectZenodoWithToken"
                    >
                      Connect to Zenodo
                    </n-button>
                  </n-flex>
                </n-form-item>

                <n-alert
                  v-if="zenodoTokenError"
                  type="error"
                  class="mt-3 max-w-xl"
                >
                  {{ zenodoTokenError }}
                </n-alert>

                <p class="pt-3 text-xs text-[var(--gray-700-200)]">
                  We check the token with Zenodo, store it encrypted, and only
                  use it to publish the releases you choose. You can disconnect
                  at any time, and deleting the token on Zenodo revokes our
                  access completely.
                </p>
              </div>

              <n-alert
                v-if="!zenodoOAuthSignIn && !zenodoTokenSignIn"
                type="warning"
                title="Connecting to Zenodo is paused"
              >
                {{ maintenanceMessageFor("zenodoToken") }}
              </n-alert>
            </template>
          </n-flex>
        </template>
      </CardDashboard>

      <div v-if="haveValidZenodoToken">
        <n-divider />

        <CardDashboard title="Select your Zenodo record">
          <template #icon>
            <Icon name="tabler:file-text" size="40" />
          </template>

          <template #content>
            <div class="flex w-full flex-col">
              <h4 class="pb-2">
                Do you want to publish this repository to a new Zenodo
                deposition or to an existing one?
              </h4>

              <n-radio-group
                v-model:value="selectedExistingDeposition"
                name="selectedExistingDeposition"
                @update:value="selectedDeposition = null"
              >
                <n-radio-button
                  key="existing"
                  value="existing"
                  label="Existing Zenodo Deposition"
                />

                <n-radio-button
                  key="new"
                  value="new"
                  label="New Zenodo Deposition"
                />
              </n-radio-group>

              <div
                v-if="selectedExistingDeposition === 'existing'"
                class="mt-4"
              >
                <h4 class="pb-2">Select your Zenodo record</h4>

                <n-select
                  v-model:value="selectedDeposition"
                  size="large"
                  clearable
                  :options="selectableDepositions"
                />

                <div
                  v-if="selectedDepositionRecordUrl"
                  class="mt-3 flex items-center gap-2 text-sm"
                >
                  <Icon name="simple-icons:zenodo" size="16" class="shrink-0" />

                  <span class="text-gray-600 dark:text-gray-400"
                    >View on Zenodo:</span
                  >

                  <NuxtLink
                    :to="selectedDepositionRecordUrl"
                    target="_blank"
                    class="text-blue-500 underline transition-all hover:text-blue-700"
                  >
                    {{ selectedDepositionRecordUrl }}
                  </NuxtLink>
                </div>
              </div>
            </div>
          </template>
        </CardDashboard>

        <div v-if="selectedExistingDeposition === 'new' || selectedDeposition">
          <n-divider />

          <h2 class="pb-6">Zenodo metadata</h2>

          <CardDashboard title="Provide repository-specific metadata">
            <template #icon>
              <Icon name="material-symbols:add-notes-outline" size="40" />
            </template>

            <template #content>
              <div class="flex w-full flex-col space-y-4">
                <n-alert type="warning" class="w-full">
                  Your <code> codemeta.json </code> file is used to generate the
                  title, description, and metadata of your Zenodo deposition.
                  Please make sure that the content of this file is correct and
                  up-to-date. Provide below metadata required by Zenodo but not
                  available in codemeta.json.
                </n-alert>

                <n-form
                  ref="zenodoFormRef"
                  :label-width="80"
                  :model="zenodoFormValue"
                  :rules="zenodoFormRules"
                  size="large"
                >
                  <n-form-item
                    label="Version number for this release"
                    path="version"
                  >
                    <n-input
                      v-model:value="zenodoFormValue.version"
                      placeholder="1.0.0"
                    />
                  </n-form-item>

                  <n-form-item label="Access Right" path="accessRight">
                    <n-radio-group
                      v-model:value="zenodoFormValue.accessRight"
                      name="accessRight"
                    >
                      <n-flex vertical>
                        <n-radio value="open"> Open Access </n-radio>

                        <n-radio value="embargoed" disabled>
                          Embargoed Access
                        </n-radio>

                        <n-radio value="restricted" disabled>
                          Restricted Access
                        </n-radio>

                        <n-radio value="closed" disabled>
                          Closed Access
                        </n-radio>
                      </n-flex>
                    </n-radio-group>
                  </n-form-item>

                  <n-button
                    class="dark:text-slate-100"
                    type="primary"
                    @click="validateZenodoForm"
                  >
                    Confirm metadata
                  </n-button>
                </n-form>
              </div>
            </template>
          </CardDashboard>

          <div
            v-if="
              githubReleaseIsDraft &&
              zenodoDraftIsReadyForRelease &&
              zenodoFormIsValid
            "
          >
            <n-divider />

            <h2 class="pb-6">Zenodo release</h2>

            <CardDashboard title="Publish release on Zenodo">
              <template #icon>
                <Icon name="simple-icons:zenodo" size="40" />
              </template>

              <template #content>
                <div class="flex w-full flex-col space-y-4">
                  <p>
                    You may save the current configuration as a draft and come
                    back to it later.
                  </p>

                  <n-alert
                    v-if="zenodoPreflightError"
                    type="error"
                    class="w-full"
                  >
                    {{ zenodoPreflightError }}
                  </n-alert>

                  <n-flex justify="space-between">
                    <n-button
                      :loading="zenodoDraftSpinner"
                      type="primary"
                      @click="startZenodoPublishProcess(false)"
                    >
                      <template #icon>
                        <Icon name="fa:save" size="16" />
                      </template>

                      Save draft
                    </n-button>

                    <n-button
                      :loading="zenodoPublishSpinner"
                      :disabled="zenodoPaused"
                      type="primary"
                      @click="startZenodoPublishProcess(true)"
                    >
                      <template #icon>
                        <Icon
                          name="material-symbols-light:play-circle"
                          size="16"
                        />
                      </template>

                      Start the Zenodo publish process
                    </n-button>
                  </n-flex>
                </div>
              </template>
            </CardDashboard>
          </div>
        </div>
      </div>
    </div>

    <n-alert v-if="!allConfirmed" type="warning" class="w-full">
      You have not yet confirmed the required metadata files. Please review the
      license and code metadata files above to continue.
    </n-alert>

    <n-collapse v-if="devMode" class="mt-8" :default-expanded-names="[]">
      <n-collapse-item title="data" name="data">
        <pre>{{ data }}</pre>
      </n-collapse-item>
    </n-collapse>

    <n-modal
      v-model:show="showZenodoBadgeModal"
      preset="card"
      :bordered="false"
      size="huge"
      :mask-closable="true"
      :close-on-esc="true"
      class="w-[750px] dark:bg-gray-800"
    >
      <template #header>
        <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">
          Latest Version DOI Badge
        </h2>
      </template>
      <!-- Main success content -->
      <div class="space-y-4">
        <!-- Snippet cards -->
        <div class="space-y-4">
          <div
            v-for="(snippet, index) in snippets"
            :key="index"
            class="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800"
          >
            <!-- Card header with snippet title & copy button -->
            <div
              class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            >
              <h4
                class="text-sm font-semibold text-gray-600 dark:text-gray-300"
              >
                {{ snippet.title }}
              </h4>

              <button
                v-if="!snippet.items"
                class="inline-flex items-center text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                @click="copyText(snippet.content)"
              >
                <Icon name="mdi:content-copy" class="mr-1 h-4 w-4" />

                <span class="text-xs">Copy</span>
              </button>
            </div>

            <!-- Combined URL items -->
            <template v-if="snippet.items">
              <div
                v-for="item in snippet.items"
                :key="item.label"
                class="border-b border-gray-100 last:border-b-0 dark:border-gray-600"
              >
                <div
                  class="flex items-center justify-between bg-gray-50 px-3 py-1.5 dark:bg-gray-700"
                >
                  <span class="text-xs text-gray-500 dark:text-gray-400">{{
                    item.label
                  }}</span>

                  <button
                    class="inline-flex items-center text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                    @click="copyText(item.content)"
                  >
                    <Icon name="mdi:content-copy" class="mr-1 h-4 w-4" />

                    <span class="text-xs">Copy</span>
                  </button>
                </div>

                <div class="bg-gray-50 p-3 dark:bg-gray-700">
                  <pre
                    class="overflow-auto font-mono text-sm"
                  ><code>{{ item.content }}</code></pre>
                </div>
              </div>
            </template>

            <!-- Regular code block -->
            <div v-else class="bg-gray-50 p-3 dark:bg-gray-700">
              <pre
                class="overflow-auto font-mono text-sm"
              ><code>{{ snippet.content.trim() }}</code></pre>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <n-flex justify="center">
          <n-button-group style="gap: 1rem">
            <NuxtLink
              v-if="data?.lastPublishedZenodoDoi"
              :to="zenodoDoiUrl(data.lastPublishedZenodoDoi)"
              target="_blank"
            >
              <n-button type="primary" size="small">
                <template #icon>
                  <Icon name="simple-icons:zenodo" size="16" />
                </template>
                View Zenodo Deposition
              </n-button>
            </NuxtLink>

            <NuxtLink
              v-if="lastSelectedGithubTag"
              :to="`https://github.com/${owner}/${repo}/releases/tag/${lastSelectedGithubTag}`"
              target="_blank"
            >
              <n-button type="primary" size="small">
                <template #icon>
                  <Icon name="simple-icons:github" size="16" />
                </template>
                View GitHub Release
              </n-button>
            </NuxtLink>
          </n-button-group>
        </n-flex>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showZenodoPublishProgressModal"
      preset="card"
      :bordered="false"
      size="huge"
      :mask-closable="false"
      :close-on-esc="false"
      class="w-[750px] dark:bg-gray-800"
    >
      <!-- HEADER SLOT: Show a dynamic title and icon -->
      <template #header>
        <div class="flex items-center space-x-2">
          <!-- Conditionally render icons based on status -->
          <Icon
            v-if="zenodoPublishStatus === 'published'"
            name="mdi:check-circle"
            class="h-6 w-6 text-green-600"
          />

          <Icon
            v-else-if="zenodoPublishStatus === 'error'"
            name="mdi:alert-circle"
            class="h-6 w-6 text-red-600"
          />

          <Icon
            v-else-if="zenodoPublishStatus === 'inProgress'"
            name="mdi:progress-clock"
            class="h-6 w-6 text-blue-600"
          />

          <!-- Dynamic title -->
          <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">
            {{
              zenodoPublishStatus === "inProgress"
                ? "Zenodo publish in progress"
                : zenodoPublishStatus === "error"
                  ? "Zenodo publish error"
                  : zenodoPublishStatus === "published"
                    ? "Zenodo publish success"
                    : "Loading..."
            }}
          </h2>
        </div>
      </template>

      <!-- BODY CONTENT -->
      <n-flex
        v-if="zenodoPublishStatus === 'inProgress'"
        vertical
        class="space-y-3"
      >
        <p class="text-gray-700 dark:text-gray-300">
          Publishing your repository to Zenodo. This may take a few minutes.
          Please do not close this window while the process is ongoing.
        </p>

        <ul class="list-none space-y-2">
          <li v-for="step in publishSteps" :key="step.key">
            <div class="flex items-center space-x-3">
              <Icon
                v-if="step.status === 'completed'"
                name="mdi:check-circle"
                class="h-5 w-5 shrink-0 text-green-500"
              />

              <Icon
                v-else-if="step.status === 'error'"
                name="mdi:alert-circle"
                class="h-5 w-5 shrink-0 text-red-500"
              />

              <Icon
                v-else-if="step.status === 'in_progress'"
                name="mdi:loading"
                class="h-5 w-5 shrink-0 animate-spin text-blue-500"
              />

              <Icon
                v-else
                name="mdi:circle-outline"
                class="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600"
              />

              <span
                :class="{
                  'font-medium text-gray-900 dark:text-gray-100':
                    step.status === 'in_progress',
                  'text-gray-400 dark:text-gray-500': step.status === 'pending',
                  'text-gray-700 dark:text-gray-300':
                    step.status === 'completed',
                  'text-red-600 dark:text-red-400': step.status === 'error',
                }"
              >
                {{ step.label }}
              </span>
            </div>

            <ZenodoUploadProgress
              v-if="step.upload"
              :upload="step.upload"
              class="ml-8 mt-2"
            />
          </li>
        </ul>
      </n-flex>

      <n-flex
        v-else-if="zenodoPublishStatus === 'error'"
        vertical
        class="space-y-3"
      >
        <p class="text-gray-700 dark:text-gray-300">
          There was an error publishing this repository to Zenodo. Please try
          again later or contact the Codefair team for assistance.
        </p>

        <n-alert v-if="zenodoPublishErrorMessage" type="error" class="w-full">
          {{ zenodoPublishErrorMessage }}
        </n-alert>

        <ul class="list-none space-y-2">
          <li v-for="step in publishSteps" :key="step.key">
            <div class="flex items-center space-x-3">
              <Icon
                v-if="step.status === 'completed'"
                name="mdi:check-circle"
                class="h-5 w-5 shrink-0 text-green-500"
              />

              <Icon
                v-else-if="step.status === 'error'"
                name="mdi:alert-circle"
                class="h-5 w-5 shrink-0 text-red-500"
              />

              <Icon
                v-else
                name="mdi:circle-outline"
                class="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600"
              />

              <span
                :class="{
                  'text-gray-400 dark:text-gray-500': step.status === 'pending',
                  'text-gray-700 dark:text-gray-300':
                    step.status === 'completed',
                  'text-red-600 dark:text-red-400': step.status === 'error',
                }"
              >
                {{ step.label }}
              </span>
            </div>

            <ZenodoUploadProgress
              v-if="step.upload"
              :upload="step.upload"
              class="ml-8 mt-2"
            />
          </li>
        </ul>
      </n-flex>

      <n-flex v-else-if="zenodoPublishStatus === 'published'" vertical>
        <!-- Main success content -->
        <div class="space-y-4">
          <p class="text-gray-700 dark:text-gray-300">
            Your software was successfully archived on Zenodo. We recommend
            reviewing the
            <NuxtLink
              :to="zenodoDepositionUrl"
              target="_blank"
              class="text-blue-500 underline transition-all hover:text-blue-700"
              >Zenodo deposition</NuxtLink
            >
            and adding additional metadata to make your software more FAIR. You
            can also view the
            <NuxtLink
              :to="githubReleaseUrl"
              target="_blank"
              class="text-blue-500 underline transition-all hover:text-blue-700"
              >GitHub release</NuxtLink
            >. Copy a snippet of your Zenodo badge and paste it into your README
            to display the badge.
          </p>

          <!-- Subheading -->
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            Latest Version DOI Badge
          </h3>

          <!-- Snippet cards -->
          <div class="space-y-4">
            <div
              v-for="(snippet, index) in snippets"
              :key="index"
              class="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800"
            >
              <!-- Card header with snippet title & copy button -->
              <div
                class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
              >
                <h4
                  class="text-sm font-semibold text-gray-600 dark:text-gray-300"
                >
                  {{ snippet.title }}
                </h4>

                <button
                  v-if="!snippet.items"
                  class="inline-flex items-center text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                  @click="copyText(snippet.content)"
                >
                  <Icon name="mdi:content-copy" class="mr-1 h-4 w-4" />

                  <span class="text-xs">Copy</span>
                </button>
              </div>

              <!-- Combined URL items -->
              <template v-if="snippet.items">
                <div
                  v-for="item in snippet.items"
                  :key="item.label"
                  class="border-b border-gray-100 last:border-b-0 dark:border-gray-600"
                >
                  <div
                    class="flex items-center justify-between bg-gray-50 px-3 py-1.5 dark:bg-gray-700"
                  >
                    <span class="text-xs text-gray-500 dark:text-gray-400">{{
                      item.label
                    }}</span>

                    <button
                      class="inline-flex items-center text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                      @click="copyText(item.content)"
                    >
                      <Icon name="mdi:content-copy" class="mr-1 h-4 w-4" />

                      <span class="text-xs">Copy</span>
                    </button>
                  </div>

                  <div class="bg-gray-50 p-3 dark:bg-gray-700">
                    <pre
                      class="overflow-auto font-mono text-sm"
                    ><code>{{ item.content }}</code></pre>
                  </div>
                </div>
              </template>

              <!-- Regular code block -->
              <div v-else class="bg-gray-50 p-3 dark:bg-gray-700">
                <pre
                  class="overflow-auto font-mono text-sm"
                ><code>{{ snippet.content.trim() }}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </n-flex>

      <!-- Loading state -->
      <n-flex v-else>
        <p>Please wait while we get the status of your workflow.</p>
      </n-flex>

      <!-- FOOTER SLOT: Action buttons -->
      <template #footer>
        <n-flex
          v-if="zenodoPublishStatus === 'published'"
          vertical
          class="w-full gap-2"
        >
          <NuxtLink :to="zenodoDepositionUrl" target="_blank" class="w-full">
            <n-button type="primary" class="w-full">
              <template #icon>
                <Icon name="simple-icons:zenodo" size="16" />
              </template>
              View Zenodo Deposition
            </n-button>
          </NuxtLink>

          <NuxtLink :to="githubReleaseUrl" target="_blank" class="w-full">
            <n-button type="primary" dashed class="w-full">
              <template #icon>
                <Icon name="simple-icons:github" size="16" />
              </template>
              View GitHub Release
            </n-button>
          </NuxtLink>

          <n-button type="tertiary" class="w-full" @click="navigateToDashboard">
            Return to Dashboard
          </n-button>
        </n-flex>

        <n-flex v-else-if="zenodoPublishStatus === 'error'" justify="center">
          <n-button type="success" size="small" @click="navigateToDashboard">
            Return to Dashboard
          </n-button>
        </n-flex>
      </template>
    </n-modal>
  </main>
</template>
