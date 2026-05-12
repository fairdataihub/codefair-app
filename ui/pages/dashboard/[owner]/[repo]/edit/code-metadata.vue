<script setup lang="ts">
import type { FormInst, FormRules, FormItemRule } from "naive-ui";
import doiRegex from "doi-regex";
import codeMetadataJSON from "@/assets/data/codeMetadata.json";
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

const devMode = process.env.NODE_ENV === "development";

definePageMeta({
  middleware: ["protected"],
});

const route = useRoute();
const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.showBreadcrumbs();

const formRef = ref<FormInst | null>(null);
const formValue = ref<CodeMetadataRequest>({
  name: "",
  applicationCategory: "",
  authors: [
    {
      affiliation: "",
      email: "",
      familyName: "",
      givenName: "",
      roles: [
        {
          endDate: null,
          role: "",
          startDate: null,
        },
      ],
      uri: "",
    },
  ],
  codeRepository: "",
  continuousIntegration: "",
  contributors: [
    {
      affiliation: "",
      email: "",
      familyName: "",
      givenName: "",
      roles: [
        {
          endDate: null,
          role: "",
          startDate: null,
        },
      ],
      uri: "",
    },
  ],
  creationDate: null,
  currentVersion: "",
  currentVersionDownloadURL: "",
  currentVersionReleaseDate: null,
  currentVersionReleaseNotes: ".",
  description: "",
  developmentStatus: null,
  firstReleaseDate: null,
  fundingCode: "",
  fundingOrganization: "",
  isPartOf: "",
  isSourceCodeOf: "",
  issueTracker: "",
  keywords: [],
  operatingSystem: [],
  otherSoftwareRequirements: [],
  programmingLanguages: [],
  referencePublication: "",
  relatedLinks: [],
  reviewAspect: "",
  reviewBody: "",
  runtimePlatform: [],
  uniqueIdentifier: "",
});

const rules = ref<FormRules>({
  name: {
    message: "Please input the name of the software",
    required: true,
    trigger: "blur",
  },
  codeRepository: {
    message: "Please input a valid code repository URL",
    trigger: "blur",
    validator: (_rule, value) => {
      if (value && !isURL(value)) {
        return false;
      }
      return true;
    },
  },
  continuousIntegration: {
    message: "Please input a valid URL for the continuous integration",
    trigger: ["blur", "input"],
    validator: (_rule, value) => {
      if (value && !isURL(value)) {
        return false;
      }
      return true;
    },
  },
  currentVersionDownloadURL: {
    message: "Please input a valid download URL for the current version",
    trigger: ["blur", "input"],
    validator: (_rule, value) => {
      if (value && !isURL(value)) {
        return false;
      }
      return true;
    },
  },
  description: {
    message: "Please input the description or abstract for the software",
    required: true,
    trigger: "blur",
  },
  isPartOf: {
    message: "Please input a valid URL",
    trigger: ["blur", "input"],
    validator: (_rule, value) => {
      if (value && !isURL(value)) {
        return false;
      }
      return true;
    },
  },
  issueTracker: {
    message: "Please input a valid issue tracker URL",
    trigger: "blur",
    validator: (_rule, value) => {
      if (value && !isURL(value)) {
        return new Error("Please input a valid URL");
      }
      return true;
    },
  },
  keywords: {
    required: true,
    trigger: "blur",
    type: "array",
    validator: (_rule, value) => {
      if (!value || value.length === 0) {
        return new Error("Please input at least one keyword");
      }
      const uniqueCount = new Set(value).size;
      if (uniqueCount !== value.length) {
        return new Error("Please ensure all keywords are unique");
      }
      const emptyStrings = value.filter((item: string) => item === "");
      if (emptyStrings.length > 0) {
        return new Error("Please remove empty strings from the keywords list");
      }
      return true;
    },
  },
  programmingLanguages: {
    message: "Please select at least one programming language",
    required: true,
    trigger: "blur",
    type: "array",
    validator: (_rule, value) => {
      if (value.length === 0) {
        return new Error("Please select at least one programming language");
      }
      const emptyStrings = value.filter((item: string) => item === "");
      if (emptyStrings.length > 0) {
        return new Error(
          "Please remove empty strings from the programming language list",
        );
      }
      return true;
    },
  },
  relatedLinks: {
    trigger: ["blur", "input"],
    type: "array",
    validator: (_rule, value) => {
      if (value.length === 0) {
        return true;
      }
      const invalidURLs = value.filter((item: string) => !isURL(item));
      if (invalidURLs.length > 0) {
        return new Error("Please add valid URLs to the related links list");
      }
      return true;
    },
  },
  uniqueIdentifier: {
    message: "Please input a valid DOI",
    trigger: ["blur", "input"],
    validator: (_rule, value) => {
      if (value && !doiRegex().test(value)) {
        return new Error("Please input a valid DOI");
      }
      return true;
    },
  },
});

// ── Tab navigation ────────────────────────────────────────────────────────────

const activeTab = ref("basic");

const tabs = [
  {
    id: "basic",
    icon: "tabler:info-circle",
    label: "Basic Info",
    required: true,
  },
  {
    id: "people",
    icon: "tabler:users",
    label: "People",
    required: true,
  },
  {
    id: "discoverability",
    icon: "tabler:search",
    label: "Discoverability",
    required: true,
  },
  {
    id: "community",
    icon: "tabler:git-branch",
    label: "Dev Community",
    required: false,
  },
  {
    id: "requirements",
    icon: "tabler:cpu",
    label: "Requirements",
    required: true,
  },
  {
    id: "version",
    icon: "tabler:tag",
    label: "Current Version",
    required: false,
  },
  {
    id: "additional",
    icon: "tabler:adjustments",
    label: "Additional Info",
    required: false,
  },
] as const;

type TabId = (typeof tabs)[number]["id"];

const sectionComplete = computed<Record<TabId, boolean>>(() => ({
  additional: true,
  basic: !!formValue.value.name && !!formValue.value.description,
  community: true,
  discoverability: formValue.value.keywords.length > 0,
  people:
    formValue.value.authors.length > 0 &&
    formValue.value.authors.every((a) => !!a.givenName),
  requirements: formValue.value.programmingLanguages.length > 0,
  version: true,
}));

const requiredTabIds = tabs
  .filter((t) => t.required)
  .map((t) => t.id) as TabId[];

const completedRequiredCount = computed(
  () => requiredTabIds.filter((id) => sectionComplete.value[id]).length,
);

const tabsWithErrors = ref(new Set<string>());

const tabFieldMap: Record<string, string[]> = {
  additional: ["developmentStatus", "isPartOf"],
  basic: ["name", "description"],
  community: [
    "codeRepository",
    "continuousIntegration",
    "issueTracker",
    "relatedLinks",
  ],
  discoverability: ["keywords", "uniqueIdentifier"],
  people: ["authors", "contributors"],
  requirements: ["programmingLanguages", "operatingSystem", "runtimePlatform"],
  version: ["currentVersion", "currentVersionDownloadURL"],
};

function markErrorTabs(errors: Array<Array<{ field?: string }>>) {
  const errorPaths = errors.flat().map((e) => e.field ?? "");
  tabsWithErrors.value = new Set(
    Object.entries(tabFieldMap)
      .filter(([, fields]) =>
        errorPaths.some((p) => fields.some((f) => p.startsWith(f))),
      )
      .map(([tabId]) => tabId),
  );
  const firstErrorTab = tabs.find((t) => tabsWithErrors.value.has(t.id));
  if (firstErrorTab) activeTab.value = firstErrorTab.id;
}

// ── Submission ────────────────────────────────────────────────────────────────

const submitLoading = ref(false);
const showSuccessModal = ref(false);
const pullRequestURL = ref<string>("");

const { owner, repo } = route.params as { owner: string; repo: string };

const { data, error } = await useFetch(`/api/${owner}/${repo}/code-metadata`, {
  headers: useRequestHeaders(["cookie"]),
});

breadcrumbsStore.setFeature({
  id: "edit-code-metadata",
  name: "Edit Code Metadata",
  icon: "tabler:code",
});

if (error.value) {
  console.error("Failed to fetch code metadata details:", error.value);

  push.error({
    title: "Failed to fetch code metadata details",
    message: "Please try again later",
  });

  throw createError(error.value);
}

if (data.value) {
  if (Object.keys(data.value.metadata).length > 0) {
    formValue.value = data.value.metadata;
  }
}

const applicationCategoryOptions =
  codeMetadataJSON.applicationCategoryOptions.map((option) => ({
    label: option,
    value: option,
  }));

const removeAuthor = (idx: number) => {
  formValue.value.authors.splice(idx, 1);
};

const removeContributor = (idx: number) => {
  formValue.value.contributors.splice(idx, 1);
};

const isURL = (value: string) => {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const saveCodeMetadataDraft = async (e: MouseEvent) => {
  e.preventDefault();
  submitLoading.value = true;

  await $fetch(`/api/${owner}/${repo}/code-metadata`, {
    body: JSON.stringify({ metadata: { ...formValue.value } }),
    headers: useRequestHeaders(["cookie"]),
    method: "PUT",
  })
    .then((_response) => {
      push.success({
        title: "Code metadata draft saved",
        message: "You can continue editing",
      });
    })
    .catch((error) => {
      console.error("Failed to save code metadata draft:", error);
      push.error({
        title: "Failed to save code metadata draft",
        message: "Please try again later",
      });
    })
    .finally(() => {
      submitLoading.value = false;
    });
};

const pushToRepository = (e: MouseEvent) => {
  e.preventDefault();
  formRef.value?.validate(async (errors) => {
    if (!errors) {
      tabsWithErrors.value = new Set();
      const body = {
        metadata: { ...formValue.value },
      };

      submitLoading.value = true;

      await $fetch(`/api/${owner}/${repo}/code-metadata`, {
        body: JSON.stringify(body),
        headers: useRequestHeaders(["cookie"]),
        method: "PUT",
      })
        .then(async (_response) => {
          const notification = push.load({
            title: "Code metadata draft saved",
            message:
              "Please wait while we push the code metadata to the repository. This may take a few seconds.",
          });

          await $fetch(`/api/${owner}/${repo}/code-metadata`, {
            headers: useRequestHeaders(["cookie"]),
            method: "POST",
          })
            .then((response) => {
              if ("prUrl" in response) {
                notification.success({
                  title: "Code metadata pushed to repository",
                  message: "Review the changes in the repository",
                });

                showSuccessModal.value = true;
                pullRequestURL.value = response.prUrl;
              } else {
                console.error(
                  "Failed to push code metadata to repository:",
                  response,
                );
                notification.error({
                  title: "Failed to push code metadata to repository",
                  message: "Please try again later",
                });
              }
            })
            .catch((error) => {
              console.error(
                "Failed to push code metadata to repository:",
                error,
              );
              push.error({
                title: "Failed to push code metadata to repository",
                message: "Please try again later",
              });
            });
        })
        .catch((error) => {
          console.error("Failed to save and push code metadata:", error);
          push.error({
            title: "Failed to save and push code metadata",
            message: "Please try again later",
          });
        })
        .finally(() => {
          submitLoading.value = false;
        });
    } else {
      console.error(errors);
      markErrorTabs(errors as Array<Array<{ field?: string }>>);
      push.error({
        title: "Invalid",
        message: "Form is invalid",
      });
    }
  });
};

const handleApplicationCategoryChange = (value: string) => {
  formValue.value.applicationCategory = value;
};

const handleDevelopmentStatusChange = (value: string) => {
  formValue.value.developmentStatus = value;
};

const navigateToPR = () => {
  showSuccessModal.value = false;
  window.open(pullRequestURL.value, "_blank");
};
</script>

<template>
  <main
    style="
      background: radial-gradient(
        circle at bottom,
        var(--radial-end) 0%,
        var(--radial-start) 80%
      );
    "
  >
    <div class="mx-auto max-w-screen-xl px-6 pb-10 pt-6">
      <!-- Compact page header -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold dark:text-slate-200">
            Edit metadata for
            <NuxtLink
              :to="`https://github.com/${owner}/${repo}`"
              target="_blank"
              class="text-blue-500 underline transition-all hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {{ repo }}
            </NuxtLink>
          </h1>

          <p class="mt-1 text-sm text-[var(--cf-text-3)]">
            Fill in the fields below to generate <code>codemeta.json</code> and

            <code>CITATION.cff</code> files for your repository.
          </p>
        </div>

        <NuxtLink
          to="https://docs.codefair.io/docs/metadata.html#metadata-editor"
          target="_blank"
          class="shrink-0 font-semibold text-[var(--link-color)] underline transition-all hover:text-[var(--link-hover)] dark:text-indigo-300 dark:hover:text-indigo-400"
        >
          Need help?
        </NuxtLink>
      </div>

      <!-- Action bar -->
      <div
        class="mt-3 flex items-center justify-between gap-4 border-b border-[var(--cf-divider)] pb-3"
      >
        <span class="text-sm text-[var(--cf-text-3)]">
          {{ completedRequiredCount }} of {{ requiredTabIds.length }} required
          sections complete
        </span>

        <div class="flex gap-3">
          <n-button
            type="tertiary"
            :loading="submitLoading"
            @click="saveCodeMetadataDraft"
          >
            <template #icon>
              <Icon name="material-symbols:save" />
            </template>

            Save draft
          </n-button>

          <n-button
            type="primary"
            :loading="submitLoading"
            @click="pushToRepository"
          >
            <template #icon>
              <Icon name="ion:push" />
            </template>

            Save and push to repository
          </n-button>
        </div>
      </div>

      <!-- Sticky tab navigation bar -->
      <div
        class="sticky top-0 z-20 -mx-6 border-b border-[var(--cf-divider)] bg-transparent px-6 pb-0 pt-2 backdrop-blur-sm"
      >
        <div class="flex gap-0.5 overflow-x-auto">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
            :class="
              activeTab === tab.id
                ? 'border-[var(--cf-primary)] text-[var(--cf-primary)] dark:border-[var(--indigo-400)] dark:text-[var(--indigo-400)]'
                : 'border-transparent text-[var(--cf-text-3)] hover:text-[var(--cf-text-2)]'
            "
            @click="activeTab = tab.id"
          >
            <Icon :name="tab.icon" size="15" />

            {{ tab.label }}

            <!-- Required indicator with status popover -->
            <n-popover
              v-if="tab.required"
              trigger="hover"
              placement="bottom"
              :keep-alive-on-hover="false"
            >
              <template #trigger>
                <span class="flex items-center gap-1" @click.stop>
                  <span class="text-xs leading-none text-[var(--cf-asterisk)]"
                    >*</span
                  >

                  <span
                    class="inline-block size-2 rounded-full"
                    :class="{
                      'bg-red-500': tabsWithErrors.has(tab.id),
                      'bg-green-500':
                        !tabsWithErrors.has(tab.id) && sectionComplete[tab.id],
                      'bg-orange-400':
                        !tabsWithErrors.has(tab.id) && !sectionComplete[tab.id],
                    }"
                  />
                </span>
              </template>

              <div class="max-w-52 text-xs">
                <template v-if="tabsWithErrors.has(tab.id)">
                  This section has validation errors. Fix them before saving.
                </template>

                <template
                  v-else-if="
                    !tabsWithErrors.has(tab.id) && sectionComplete[tab.id]
                  "
                >
                  All required fields in this section are complete.
                </template>

                <template v-else>
                  This section has required fields that need to be filled.
                </template>
              </div>
            </n-popover>
          </button>
        </div>
      </div>

      <!-- Form -->
      <n-form
        ref="formRef"
        :label-width="80"
        :model="formValue"
        :rules="rules"
        size="large"
      >
        <!-- ── Basic Info ──────────────────────────────────────────────── -->
        <div v-show="activeTab === 'basic'" class="mt-6">
          <div class="mb-5 flex items-start gap-3">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-[oklch(30%_0.05_265)] dark:text-[oklch(78%_0.08_265)]"
            >
              <Icon name="tabler:info-circle" size="20" />
            </div>

            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold dark:text-gray-100">
                  Basic Information
                </h2>

                <n-tag type="warning" size="small" :bordered="false">
                  Required
                </n-tag>
              </div>

              <p class="mt-0.5 text-sm text-[var(--cf-text-3)]">
                General information about the software.
              </p>
            </div>
          </div>

          <n-card class="rounded-lg">
            <n-form-item label="Software Name" path="name">
              <n-input
                v-model:value="formValue.name"
                placeholder="Input Name"
              />
            </n-form-item>

            <n-form-item label="Description" path="description">
              <n-input
                v-model:value="formValue.description"
                placeholder="Input Description"
                type="textarea"
                :rows="4"
              />
            </n-form-item>

            <n-form-item label="Creation Date" path="creationDate">
              <n-date-picker
                v-model:value="formValue.creationDate"
                type="date"
              />
            </n-form-item>

            <n-form-item label="First Release Date" path="firstReleaseDate">
              <n-date-picker
                v-model:value="formValue.firstReleaseDate"
                type="date"
              />
            </n-form-item>
          </n-card>
        </div>

        <!-- ── People ──────────────────────────────────────────────────── -->
        <div v-show="activeTab === 'people'" class="mt-6">
          <div class="mb-5 flex items-start gap-3">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-[oklch(30%_0.05_265)] dark:text-[oklch(78%_0.08_265)]"
            >
              <Icon name="tabler:users" size="20" />
            </div>

            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold dark:text-gray-100">
                  Authors &amp; Contributors
                </h2>

                <n-tag type="warning" size="small" :bordered="false">
                  Required
                </n-tag>
              </div>

              <p class="mt-0.5 text-sm text-[var(--cf-text-3)]">
                People who created or contributed to the software.
              </p>
            </div>
          </div>

          <!-- Authors -->
          <div class="mb-3 flex items-center justify-between">
            <h3
              class="text-sm font-semibold uppercase tracking-wide text-[var(--cf-text-3)]"
            >
              Authors
            </h3>

            <n-button
              type="primary"
              size="small"
              @click="
                formValue.authors.push({
                  roles: [],
                  givenName: '',
                  familyName: '',
                  email: '',
                  affiliation: '',
                  uri: '',
                })
              "
            >
              <template #icon>
                <Icon name="tabler:plus" size="14" />
              </template>

              Add Author
            </n-button>
          </div>

          <n-form-item
            path="authors"
            :show-label="false"
            :rule="{
              message: 'Please enter at least one author',
              required: true,
              type: 'array',
              trigger: ['blur', 'input'],
            }"
            class="w-full"
          >
            <n-flex vertical size="large" class="w-full">
              <CardCollapsible
                v-for="(author, index) in formValue.authors"
                :key="index"
                :title="
                  author.givenName
                    ? `${author.givenName} ${author.familyName || ''}`.trim()
                    : `Author ${index + 1}`
                "
                :subtitle="author.email || author.affiliation || ''"
                :collapse="index > 0"
              >
                <template #header-extra>
                  <n-popconfirm @positive-click="removeAuthor(index)">
                    <template #trigger>
                      <n-button text type="error" size="small" class="p-1.5">
                        <Icon name="tabler:trash" size="15" />
                      </n-button>
                    </template>

                    Remove this author?
                  </n-popconfirm>
                </template>

                <n-form-item
                  label="Given Name"
                  :path="`authors[${index}].givenName`"
                  :rule="{
                    message: 'Please enter a name',
                    required: true,
                    trigger: ['blur', 'input'],
                  }"
                >
                  <n-input
                    v-model:value="author.givenName"
                    placeholder="Bertolt"
                    clearable
                  />
                </n-form-item>

                <n-form-item
                  label="Family Name"
                  :path="`authors[${index}].familyName`"
                >
                  <n-input
                    v-model:value="author.familyName"
                    placeholder="Brecht"
                    clearable
                  />
                </n-form-item>

                <n-form-item
                  label="Email"
                  :path="`authors[${index}].email`"
                  :rule="{
                    message: 'Please enter a valid email address',
                    trigger: ['blur', 'input'],
                    type: 'email',
                  }"
                >
                  <n-input
                    v-model:value="author.email"
                    placeholder="hello@codefair.io"
                    clearable
                  />
                </n-form-item>

                <n-form-item
                  label="Affiliation"
                  :path="`authors[${index}].affiliation`"
                >
                  <n-input
                    v-model:value="author.affiliation"
                    placeholder="University of Example"
                    clearable
                  />
                </n-form-item>

                <n-form-item
                  label="URI"
                  :path="`authors[${index}].uri`"
                  :rule="{
                    message: 'Please enter a valid URL',
                    trigger: ['blur', 'input'],
                    validator: (_rule: FormItemRule, value: string) => {
                      if (value && !isURL(value)) {
                        return false;
                      }
                      return true;
                    },
                  }"
                >
                  <n-input
                    v-model:value="author.uri"
                    placeholder="https://example.com/bertoltbrecht or https://orcid.org/0000-0002-4306-4464"
                    clearable
                  />
                </n-form-item>

                <!-- Roles -->
                <n-flex
                  v-if="author.roles?.length"
                  vertical
                  size="medium"
                  class="mb-3"
                >
                  <CardCollapsible
                    v-for="(role, roleIndex) in author.roles"
                    :key="roleIndex"
                    :title="role.role || `Role ${roleIndex + 1}`"
                    variant="inset"
                    :collapse="true"
                  >
                    <template #header-extra>
                      <n-button
                        text
                        type="error"
                        size="small"
                        class="p-1"
                        @click="
                          formValue.authors[index].roles.splice(roleIndex, 1)
                        "
                      >
                        <Icon name="tabler:trash" size="14" />
                      </n-button>
                    </template>

                    <n-form-item
                      label="Role"
                      :path="`authors[${index}].roles[${roleIndex}].role`"
                      :rule="{
                        message: 'Please enter a role',
                        required: true,
                        trigger: ['blur', 'input'],
                      }"
                    >
                      <n-input
                        v-model:value="role.role"
                        placeholder="Developer"
                        clearable
                      />
                    </n-form-item>

                    <n-form-item
                      label="Start Date"
                      :path="`authors[${index}].roles[${roleIndex}].startDate`"
                    >
                      <n-date-picker
                        v-model:value="role.startDate"
                        type="date"
                        clearable
                      />
                    </n-form-item>

                    <n-form-item
                      label="End Date"
                      :path="`authors[${index}].roles[${roleIndex}].endDate`"
                    >
                      <n-date-picker
                        v-model:value="role.endDate"
                        type="date"
                        clearable
                      />
                    </n-form-item>
                  </CardCollapsible>
                </n-flex>

                <n-button
                  class="w-full py-4"
                  type="tertiary"
                  size="small"
                  @click="formValue.authors[index].roles.push({ role: '' })"
                >
                  <template #icon>
                    <Icon name="tabler:plus" size="16" />
                  </template>

                  <span>Add Role</span>
                </n-button>
              </CardCollapsible>
            </n-flex>
          </n-form-item>

          <SectionDivider class="my-7" />

          <!-- Contributors -->
          <div class="mb-3 flex items-center justify-between">
            <h3
              class="text-sm font-semibold uppercase tracking-wide text-[var(--cf-text-3)]"
            >
              Contributors
            </h3>

            <n-button
              type="primary"
              size="small"
              @click="
                formValue.contributors.push({
                  roles: [],
                  givenName: '',
                  familyName: '',
                  email: '',
                  affiliation: '',
                  uri: '',
                })
              "
            >
              <template #icon>
                <Icon name="tabler:plus" size="14" />
              </template>

              Add Contributor
            </n-button>
          </div>

          <n-form-item path="contributors" :show-label="false" class="w-full">
            <n-flex vertical size="large" class="w-full">
              <CardCollapsible
                v-for="(contributor, index) in formValue.contributors"
                :key="index"
                :title="
                  contributor.givenName
                    ? `${contributor.givenName} ${contributor.familyName || ''}`.trim()
                    : `Contributor ${index + 1}`
                "
                :subtitle="contributor.email || contributor.affiliation || ''"
                :collapse="index > 0"
              >
                <template #header-extra>
                  <n-popconfirm @positive-click="removeContributor(index)">
                    <template #trigger>
                      <n-button text type="error" size="small" class="p-1.5">
                        <Icon name="tabler:trash" size="15" />
                      </n-button>
                    </template>

                    Remove this contributor?
                  </n-popconfirm>
                </template>

                <n-form-item
                  label="Given Name"
                  :path="`contributors[${index}].givenName`"
                  :rule="{
                    message: 'Please enter a name',
                    required: true,
                    trigger: ['blur', 'input'],
                  }"
                >
                  <n-input
                    v-model:value="contributor.givenName"
                    placeholder="Bertolt"
                    clearable
                  />
                </n-form-item>

                <n-form-item
                  label="Family Name"
                  :path="`contributors[${index}].familyName`"
                >
                  <n-input
                    v-model:value="contributor.familyName"
                    placeholder="Brecht"
                    clearable
                  />
                </n-form-item>

                <n-form-item
                  label="Email"
                  :path="`contributors[${index}].email`"
                  :rule="{
                    message: 'Please enter a valid email address',
                    trigger: ['blur', 'input'],
                    type: 'email',
                  }"
                >
                  <n-input
                    v-model:value="contributor.email"
                    placeholder="hello@codefair.io"
                    clearable
                  />
                </n-form-item>

                <n-form-item
                  label="Affiliation"
                  :path="`contributors[${index}].affiliation`"
                >
                  <n-input
                    v-model:value="contributor.affiliation"
                    placeholder="University of Example"
                    clearable
                  />
                </n-form-item>

                <n-form-item
                  label="URI"
                  :path="`contributors[${index}].uri`"
                  :rule="{
                    message: 'Please enter a valid URL',
                    trigger: ['blur', 'input'],
                    validator: (_rule: FormItemRule, value: string) => {
                      if (value && !isURL(value)) {
                        return false;
                      }
                      return true;
                    },
                  }"
                >
                  <n-input
                    v-model:value="contributor.uri"
                    placeholder="https://example.com/bertoltbrecht or https://orcid.org/0000-0002-4306-4464"
                    clearable
                  />
                </n-form-item>

                <!-- Roles -->
                <n-flex
                  v-if="contributor.roles?.length"
                  vertical
                  size="medium"
                  class="mb-3"
                >
                  <CardCollapsible
                    v-for="(role, roleIndex) in contributor.roles"
                    :key="roleIndex"
                    :title="role.role || `Role ${roleIndex + 1}`"
                    variant="inset"
                    :collapse="true"
                  >
                    <template #header-extra>
                      <n-button
                        text
                        type="error"
                        size="small"
                        class="p-1"
                        @click="
                          formValue.contributors[index].roles.splice(
                            roleIndex,
                            1,
                          )
                        "
                      >
                        <Icon name="tabler:trash" size="14" />
                      </n-button>
                    </template>

                    <n-form-item
                      label="Role"
                      :path="`contributors[${index}].roles[${roleIndex}].role`"
                      :rule="{
                        message: 'Please enter a role',
                        required: true,
                        trigger: ['blur', 'input'],
                      }"
                    >
                      <n-input
                        v-model:value="role.role"
                        placeholder="Developer"
                        clearable
                      />
                    </n-form-item>

                    <n-form-item
                      label="Start Date"
                      :path="`contributors[${index}].roles[${roleIndex}].startDate`"
                    >
                      <n-date-picker
                        v-model:value="role.startDate"
                        type="date"
                        clearable
                      />
                    </n-form-item>

                    <n-form-item
                      label="End Date"
                      :path="`contributors[${index}].roles[${roleIndex}].endDate`"
                    >
                      <n-date-picker
                        v-model:value="role.endDate"
                        type="date"
                        clearable
                      />
                    </n-form-item>
                  </CardCollapsible>
                </n-flex>

                <n-button
                  class="w-full py-4"
                  type="tertiary"
                  size="small"
                  @click="
                    formValue.contributors[index].roles.push({ role: '' })
                  "
                >
                  <template #icon>
                    <Icon name="tabler:plus" size="16" />
                  </template>

                  Add Role
                </n-button>
              </CardCollapsible>
            </n-flex>
          </n-form-item>
        </div>

        <!-- ── Discoverability ─────────────────────────────────────────── -->
        <div v-show="activeTab === 'discoverability'" class="mt-6">
          <div class="mb-5 flex items-start gap-3">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-[oklch(30%_0.05_265)] dark:text-[oklch(78%_0.08_265)]"
            >
              <Icon name="tabler:search" size="20" />
            </div>

            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold dark:text-gray-100">
                  Discoverability
                </h2>

                <n-tag type="warning" size="small" :bordered="false">
                  Required
                </n-tag>
              </div>

              <p class="mt-0.5 text-sm text-[var(--cf-text-3)]">
                Information to help users discover the software.
              </p>
            </div>
          </div>

          <n-card class="rounded-lg">
            <n-form-item
              label="Unique Identifier (DOI)"
              path="uniqueIdentifier"
            >
              <n-input
                v-model:value="formValue.uniqueIdentifier"
                placeholder="10.60775/fairhub.1"
              />
            </n-form-item>

            <n-form-item
              label="Application Category"
              path="applicationCategory"
            >
              <n-select
                v-model:value="formValue.applicationCategory"
                placeholder="Select Category"
                :options="applicationCategoryOptions"
                @update:value="handleApplicationCategoryChange"
              />
            </n-form-item>

            <n-form-item label="Keywords" path="keywords">
              <n-dynamic-input
                v-model:value="formValue.keywords"
                placeholder="Input Keyword"
              />
            </n-form-item>

            <n-form-item label="Funding Code" path="fundingCode">
              <n-input
                v-model:value="formValue.fundingCode"
                placeholder="Input Funding Code"
              />
            </n-form-item>

            <n-form-item
              label="Funding Organization"
              path="fundingOrganization"
            >
              <n-input
                v-model:value="formValue.fundingOrganization"
                placeholder="Input Funding Organization"
              />
            </n-form-item>
          </n-card>
        </div>

        <!-- ── Development Community ──────────────────────────────────── -->
        <div v-show="activeTab === 'community'" class="mt-6">
          <div class="mb-5 flex items-start gap-3">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-[oklch(30%_0.05_265)] dark:text-[oklch(78%_0.08_265)]"
            >
              <Icon name="tabler:git-branch" size="20" />
            </div>

            <div class="flex-1">
              <h2 class="text-lg font-semibold dark:text-gray-100">
                Development Community
              </h2>

              <p class="mt-0.5 text-sm text-[var(--cf-text-3)]">
                Information about the development community of the software.
              </p>
            </div>
          </div>

          <n-card class="rounded-lg">
            <n-form-item label="Code Repository" path="codeRepository">
              <n-input
                v-model:value="formValue.codeRepository"
                placeholder="https://github.com/fairdataihub/codefair-app"
              />
            </n-form-item>

            <n-form-item
              label="Continuous Integration"
              path="continuousIntegration"
            >
              <n-input
                v-model:value="formValue.continuousIntegration"
                placeholder="https://ci.example.com"
              />
            </n-form-item>

            <n-form-item label="Issue Tracker" path="issueTracker">
              <n-input
                v-model:value="formValue.issueTracker"
                placeholder="https://issues.example.com"
              />
            </n-form-item>

            <n-form-item label="Related Links" path="relatedLinks">
              <n-dynamic-input
                v-model:value="formValue.relatedLinks"
                placeholder="Input Related Link"
              />
            </n-form-item>
          </n-card>
        </div>

        <!-- ── Software Requirements ──────────────────────────────────── -->
        <div v-show="activeTab === 'requirements'" class="mt-6">
          <div class="mb-5 flex items-start gap-3">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-[oklch(30%_0.05_265)] dark:text-[oklch(78%_0.08_265)]"
            >
              <Icon name="tabler:cpu" size="20" />
            </div>

            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold dark:text-gray-100">
                  Software Requirements
                </h2>

                <n-tag type="warning" size="small" :bordered="false">
                  Required
                </n-tag>
              </div>

              <p class="mt-0.5 text-sm text-[var(--cf-text-3)]">
                Run-time environment required to run the software.
              </p>
            </div>
          </div>

          <n-card class="rounded-lg">
            <n-form-item
              label="Programming Languages"
              path="programmingLanguages"
            >
              <n-select
                v-model:value="formValue.programmingLanguages"
                placeholder="Select Languages"
                filterable
                multiple
                tag
                clearable
                :options="codeMetadataJSON.programmingLanguageOptions"
              />
            </n-form-item>

            <n-form-item label="Runtime Platform" path="runtimePlatform">
              <n-select
                v-model:value="formValue.runtimePlatform"
                placeholder="Select Platforms"
                filterable
                multiple
                tag
                clearable
                :options="codeMetadataJSON.runtimePlatformOptions"
              />
            </n-form-item>

            <n-form-item label="Operating System" path="operatingSystem">
              <n-select
                v-model:value="formValue.operatingSystem"
                placeholder="Select Operating Systems"
                filterable
                multiple
                tag
                clearable
                :options="codeMetadataJSON.operatingSystemOptions"
              />
            </n-form-item>

            <n-form-item
              label="Other Software Requirements"
              path="otherSoftwareRequirements"
            >
              <n-dynamic-input
                v-model:value="formValue.otherSoftwareRequirements"
                placeholder="Input Requirement"
              />
            </n-form-item>
          </n-card>
        </div>

        <!-- ── Current Version ────────────────────────────────────────── -->
        <div v-show="activeTab === 'version'" class="mt-6">
          <div class="mb-5 flex items-start gap-3">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-[oklch(30%_0.05_265)] dark:text-[oklch(78%_0.08_265)]"
            >
              <Icon name="tabler:tag" size="20" />
            </div>

            <div class="flex-1">
              <h2 class="text-lg font-semibold dark:text-gray-100">
                Current Version
              </h2>

              <p class="mt-0.5 text-sm text-[var(--cf-text-3)]">
                Details about the current version and its release.
              </p>
            </div>
          </div>

          <n-card class="rounded-lg">
            <n-form-item label="Version Number" path="currentVersion">
              <n-input
                v-model:value="formValue.currentVersion"
                placeholder="1.2.5"
              />
            </n-form-item>

            <n-form-item label="Release Date" path="currentVersionReleaseDate">
              <n-date-picker
                v-model:value="formValue.currentVersionReleaseDate as number"
                type="date"
              />
            </n-form-item>

            <n-form-item label="Download URL" path="currentVersionDownloadURL">
              <n-input
                v-model:value="formValue.currentVersionDownloadURL"
                placeholder="https://example.com/download/1.0.0"
              />
            </n-form-item>

            <n-form-item
              label="Release Notes"
              path="currentVersionReleaseNotes"
            >
              <n-input
                v-model:value="formValue.currentVersionReleaseNotes"
                placeholder="Initial stable release."
                type="textarea"
                :rows="4"
              />
            </n-form-item>
          </n-card>
        </div>

        <!-- ── Additional Information ─────────────────────────────────── -->
        <div v-show="activeTab === 'additional'" class="mt-6">
          <div class="mb-5 flex items-start gap-3">
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-[oklch(30%_0.05_265)] dark:text-[oklch(78%_0.08_265)]"
            >
              <Icon name="tabler:adjustments" size="20" />
            </div>

            <div class="flex-1">
              <h2 class="text-lg font-semibold dark:text-gray-100">
                Additional Information
              </h2>

              <p class="mt-0.5 text-sm text-[var(--cf-text-3)]">
                Additional information about the software.
              </p>
            </div>
          </div>

          <n-card class="rounded-lg">
            <n-form-item label="Development Status" path="developmentStatus">
              <n-select
                v-model:value="formValue.developmentStatus"
                placeholder="Select Status"
                :options="codeMetadataJSON.developmentStatusOptions"
                @update:value="handleDevelopmentStatusChange"
              />
            </n-form-item>

            <n-form-item label="Is Source Code Of" path="isSourceCodeOf">
              <n-input
                v-model:value="formValue.isSourceCodeOf"
                placeholder="Bigger Application"
              />
            </n-form-item>

            <n-form-item label="Is Part Of" path="isPartOf">
              <n-input
                v-model:value="formValue.isPartOf"
                placeholder="Bigger Suite"
              />
            </n-form-item>
          </n-card>
        </div>
      </n-form>

      <!-- Dev mode data debug -->
      <n-collapse v-if="devMode" class="mt-8" :default-expanded-names="[]">
        <n-collapse-item title="data" name="data">
          <pre>{{ data }}</pre>
        </n-collapse-item>
      </n-collapse>

      <!-- Success modal -->
      <n-modal v-model:show="showSuccessModal" transform-origin="center">
        <n-card
          style="width: 600px"
          title="One more thing!"
          :bordered="false"
          size="huge"
          role="dialog"
          aria-modal="true"
          class="dark:bg-gray-600"
        >
          A pull request to update the code metadata files has been submitted.
          Please approve the pull request to make the changes live.

          <template #footer>
            <n-flex justify="end">
              <n-button type="success" @click="navigateToPR">
                <template #icon>
                  <Icon name="icon-park-outline:success" />
                </template>

                View Pull Request
              </n-button>
            </n-flex>
          </template>
        </n-card>
      </n-modal>
    </div>
  </main>
</template>
