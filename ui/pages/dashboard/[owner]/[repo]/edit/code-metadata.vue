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

// ── Section navigation ────────────────────────────────────────────────────────

const sections = [
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

type TabId = (typeof sections)[number]["id"];

const activeSection = ref<TabId>("basic");

const sectionCardRefs: Record<string, { open(): void } | null> = {
  additional: null,
  basic: null,
  community: null,
  discoverability: null,
  people: null,
  requirements: null,
  version: null,
};

const scrollToSection = (id: TabId) => {
  sectionCardRefs[id]?.open();
  document
    .getElementById(`section-${id}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const updateActiveSection = () => {
  const nearBottom =
    window.scrollY + window.innerHeight >=
    document.documentElement.scrollHeight - 16;

  if (nearBottom) {
    activeSection.value = sections[sections.length - 1].id as TabId;
    return;
  }

  const threshold = window.innerHeight * 0.35;
  let current: TabId = sections[0].id as TabId;

  for (const section of sections) {
    const el = document.getElementById(`section-${section.id}`);
    if (!el) continue;
    if (el.getBoundingClientRect().top <= threshold) {
      current = section.id as TabId;
    }
  }

  activeSection.value = current;
};

onMounted(() => {
  window.addEventListener("scroll", updateActiveSection, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("scroll", updateActiveSection);
});

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

const requiredTabIds = sections
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
  const firstErrorSection = sections.find((t) =>
    tabsWithErrors.value.has(t.id),
  );
  if (firstErrorSection) scrollToSection(firstErrorSection.id);
}

const sectionStatus = (id: TabId): "complete" | "incomplete" | "error" => {
  if (tabsWithErrors.value.has(id)) return "error";
  if (sectionComplete.value[id]) return "complete";
  return "incomplete";
};

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
    <div class="mx-auto max-w-screen-xl px-6 pb-10 pt-2">
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

      <!-- Two-column layout: TOC sidebar + form -->
      <div class="mt-6 flex gap-8">
        <!-- Sticky TOC sidebar -->
        <aside
          class="hidden w-52 shrink-0 self-start lg:sticky lg:top-6 lg:block"
        >
          <div
            class="rounded-lg border border-[var(--cf-divider)] bg-[var(--cf-card-bg)] p-3"
          >
            <p
              class="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--cf-text-3)]"
            >
              Sections
            </p>

            <nav class="space-y-0.5">
              <button
                v-for="section in sections"
                :key="section.id"
                class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors"
                :class="
                  activeSection === section.id
                    ? 'bg-indigo-50 font-medium text-[var(--cf-primary)] dark:bg-[oklch(30%_0.05_265)] dark:text-[oklch(78%_0.08_265)]'
                    : 'text-[var(--cf-text-2)] hover:bg-[oklch(97%_0.01_260)] dark:hover:bg-[oklch(26%_0.02_260)]'
                "
                @click="scrollToSection(section.id)"
              >
                <Icon :name="section.icon" size="14" class="shrink-0" />

                <span class="flex-1 truncate text-left">
                  {{ section.label }}
                </span>

                <span
                  v-if="section.required"
                  class="size-2 shrink-0 rounded-full"
                  :class="{
                    'bg-green-500': sectionStatus(section.id) === 'complete',
                    'bg-orange-400': sectionStatus(section.id) === 'incomplete',
                    'bg-red-500': sectionStatus(section.id) === 'error',
                  }"
                />
              </button>
            </nav>

            <div
              class="mt-3 border-t border-[var(--cf-divider)] pt-3 text-xs text-[var(--cf-text-3)]"
            >
              {{ completedRequiredCount }} /
              {{ requiredTabIds.length }} required complete
            </div>
          </div>
        </aside>

        <!-- Form content -->
        <div class="min-w-0 flex-1">
          <n-form
            ref="formRef"
            :label-width="80"
            :model="formValue"
            :rules="rules"
            size="large"
            class="space-y-4"
          >
            <!-- ── Basic Info ──────────────────────────────────────────────── -->
            <CardCollapsible
              id="section-basic"
              :ref="(el: any) => (sectionCardRefs['basic'] = el)"
              title="Basic Information"
              subtitle="The name, description, and key dates that identify your software"
              icon="tabler:info-circle"
              :status="sectionStatus('basic')"
              :required="true"
            >
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
            </CardCollapsible>

            <!-- ── People ──────────────────────────────────────────────────── -->
            <CardCollapsible
              id="section-people"
              :ref="(el: any) => (sectionCardRefs['people'] = el)"
              title="Authors & Contributors"
              subtitle="Credit the people who created and contributed to this software"
              icon="tabler:users"
              :status="sectionStatus('people')"
              :required="true"
            >
              <!-- Authors -->
              <div class="relative mb-4">
                <div class="absolute inset-0 flex items-center">
                  <div
                    class="w-full border-t-2 border-indigo-200 dark:border-[oklch(30%_0.05_265)]"
                  />
                </div>

                <div class="relative flex justify-center">
                  <span
                    class="bg-[var(--cf-card-bg)] px-3 text-sm font-semibold uppercase tracking-wide text-indigo-400 dark:text-[oklch(60%_0.08_265)]"
                  >
                    Authors
                  </span>
                </div>
              </div>

              <n-form-item
                v-if="formValue.authors.length > 0"
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
                    :collapse="index < formValue.authors.length - 1"
                  >
                    <template #header-extra>
                      <n-popconfirm @positive-click="removeAuthor(index)">
                        <template #trigger>
                          <n-button
                            text
                            type="error"
                            size="small"
                            class="p-1.5"
                          >
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
                        :collapse="roleIndex < author.roles.length - 1"
                      >
                        <template #header-extra>
                          <n-button
                            text
                            type="error"
                            size="small"
                            class="p-1"
                            @click="
                              formValue.authors[index].roles.splice(
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

              <n-button
                class="mt-2 w-full"
                type="primary"
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
                  <Icon name="tabler:plus" size="16" />
                </template>

                Add Author
              </n-button>

              <!-- Authors / Contributors divider -->
              <div class="relative my-8">
                <div class="absolute inset-0 flex items-center">
                  <div
                    class="w-full border-t-2 border-indigo-200 dark:border-[oklch(30%_0.05_265)]"
                  />
                </div>

                <div class="relative flex justify-center">
                  <span
                    class="bg-[var(--cf-card-bg)] px-3 text-sm font-semibold uppercase tracking-wide text-indigo-400 dark:text-[oklch(60%_0.08_265)]"
                  >
                    Contributors
                  </span>
                </div>
              </div>

              <n-form-item
                v-if="formValue.contributors.length > 0"
                path="contributors"
                :show-label="false"
                class="w-full"
              >
                <n-flex vertical size="large" class="w-full">
                  <CardCollapsible
                    v-for="(contributor, index) in formValue.contributors"
                    :key="index"
                    :title="
                      contributor.givenName
                        ? `${contributor.givenName} ${contributor.familyName || ''}`.trim()
                        : `Contributor ${index + 1}`
                    "
                    :subtitle="
                      contributor.email || contributor.affiliation || ''
                    "
                    :collapse="index < formValue.contributors.length - 1"
                  >
                    <template #header-extra>
                      <n-popconfirm @positive-click="removeContributor(index)">
                        <template #trigger>
                          <n-button
                            text
                            type="error"
                            size="small"
                            class="p-1.5"
                          >
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
                        :collapse="roleIndex < contributor.roles.length - 1"
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

              <n-button
                class="mt-2 w-full"
                type="primary"
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
                  <Icon name="tabler:plus" size="16" />
                </template>

                Add Contributor
              </n-button>
            </CardCollapsible>

            <!-- ── Discoverability ─────────────────────────────────────────── -->
            <CardCollapsible
              id="section-discoverability"
              :ref="(el: any) => (sectionCardRefs['discoverability'] = el)"
              title="Discoverability"
              subtitle="Keywords, identifiers, and categories that help others find your software"
              icon="tabler:search"
              :status="sectionStatus('discoverability')"
              :required="true"
            >
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
            </CardCollapsible>

            <!-- ── Development Community ──────────────────────────────────── -->
            <CardCollapsible
              id="section-community"
              :ref="(el: any) => (sectionCardRefs['community'] = el)"
              title="Development Community"
              subtitle="Repository, issue tracker, and links to help users engage with your project"
              icon="tabler:git-branch"
              :status="sectionStatus('community')"
            >
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
            </CardCollapsible>

            <!-- ── Software Requirements ──────────────────────────────────── -->
            <CardCollapsible
              id="section-requirements"
              :ref="(el: any) => (sectionCardRefs['requirements'] = el)"
              title="Software Requirements"
              subtitle="Programming languages, operating systems, and runtime platforms needed to run this software"
              icon="tabler:cpu"
              :status="sectionStatus('requirements')"
              :required="true"
            >
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
            </CardCollapsible>

            <!-- ── Current Version ────────────────────────────────────────── -->
            <CardCollapsible
              id="section-version"
              :ref="(el: any) => (sectionCardRefs['version'] = el)"
              title="Current Version"
              subtitle="Version number, release date, download URL, and notes for the latest release"
              icon="tabler:tag"
              :status="sectionStatus('version')"
            >
              <n-form-item label="Version Number" path="currentVersion">
                <n-input
                  v-model:value="formValue.currentVersion"
                  placeholder="1.2.5"
                />
              </n-form-item>

              <n-form-item
                label="Release Date"
                path="currentVersionReleaseDate"
              >
                <n-date-picker
                  v-model:value="formValue.currentVersionReleaseDate as number"
                  type="date"
                />
              </n-form-item>

              <n-form-item
                label="Download URL"
                path="currentVersionDownloadURL"
              >
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
            </CardCollapsible>

            <!-- ── Additional Information ─────────────────────────────────── -->
            <CardCollapsible
              id="section-additional"
              :ref="(el: any) => (sectionCardRefs['additional'] = el)"
              title="Additional Information"
              subtitle="Development status and relationships to other software or larger systems"
              icon="tabler:adjustments"
              :status="sectionStatus('additional')"
            >
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
            </CardCollapsible>
          </n-form>

          <!-- Bottom action buttons -->
          <div
            class="mt-6 flex justify-end gap-3 border-t border-[var(--cf-divider)] pt-4"
          >
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
      </div>

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
