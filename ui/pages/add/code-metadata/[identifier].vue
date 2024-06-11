<script setup lang="ts">
import type { FormInst, FormRules } from "naive-ui";
import codeMetadataJSON from "@/assets/data/codeMetadata.json";

definePageMeta({
  middleware: ["protected"],
});

const route = useRoute();

const formRef = ref<FormInst | null>(null);
const formValue = ref<CodeMetadataRequest>({
  name: "Example Project",
  applicationCategory: "Software Development",
  authors: [
    {
      affiliation: "Example University",
      email: "john.doe@example.com",
      familyName: "Doe",
      givenName: "John",
      roles: [
        {
          endDate: 1622505600000,
          role: "Developer",
          startDate: 1672531200000,
        },
      ],
      uri: "https://example.com/johndoe",
    },
    {
      affiliation: "Example Institute",
      email: "jane.smith@example.com",
      familyName: "Smith",
      givenName: "Jane",
      roles: [
        {
          endDate: 1622505600000,
          role: "Tester",
          startDate: 1672531200000,
        },
      ],
      uri: "https://example.com/janesmith",
    },
  ],
  codeRepository: "https://github.com/example/project",
  continuousIntegration: "https://ci.example.com",
  contributors: [
    {
      affiliation: "Example Labs",
      email: "alice.johnson@example.com",
      familyName: "Johnson",
      givenName: "Alice",
      roles: [
        {
          endDate: 1622505600000,
          role: "Developer",
          startDate: 1672531200000,
        },
      ],
      uri: "https://example.com/alicejohnson",
    },
    {
      affiliation: "Example Corp",
      email: "bob.brown@example.com",
      familyName: "Brown",
      givenName: "Bob",
      roles: [
        {
          endDate: 1622505600000,
          role: "Tester",
          startDate: 1672531200000,
        },
      ],
      uri: "https://example.com/bobbrown",
    },
  ],
  creationDate: 1622505600000,
  currentVersion: "1.0.0",
  currentVersionDownloadURL: "https://example.com/download/1.0.0",
  currentVersionReleaseDate: 1672531200000,
  currentVersionReleaseNotes: "Initial stable release.",
  description: "This is an example project to demonstrate a JSON schema.",
  developmentStatus: "active",
  firstReleaseDate: 1672531200000,
  fundingCode: "FC-67890",
  fundingOrganization: "Example Funding Org",
  isPartOf: "Example Suite",
  isSourceCodeOf: "Example Suite",
  issueTracker: "https://issues.example.com",
  keywords: ["example", "json", "schema"],
  license: "MIT",
  operatingSystem: ["Linux", "macOS", "Windows"],
  otherSoftwareRequirements: ["Docker"],
  programmingLanguages: ["Python", "JavaScript"],
  referencePublication: "Doe, J. (2023). Example Project. Journal of Examples.",
  relatedLinks: ["https://example.com/docs", "https://example.com/tutorials"],
  reviewAspect: "Code Quality",
  reviewBody: "This project has been thoroughly reviewed for code quality.",
  runtimePlatform: [".Net"],
  uniqueIdentifier: "12345-abcde",
});

const rules = ref<FormRules>({
  name: {
    message: "Please input the name of the software",
    required: true,
    trigger: "blur",
  },
  description: {
    message: "Please input the description or abstract for the software",
    required: true,
    trigger: "blur",
  },
  keywords: {
    message: "Please input at least one keyword",
    required: true,
    trigger: "blur",
    type: "array",
  },
  programmingLanguages: {
    message: "Please select at least one programming language",
    required: true,
    trigger: "blur",
    type: "array",
  },
});

const { identifier } = route.params as { identifier: string };

const { data, error } = await useFetch(`/api/codeMetadata/${identifier}`, {
  headers: useRequestHeaders(["cookie"]),
});

if (error.value) {
  push.error({
    title: "Failed to fetch code metadata details",
    message: "Please try again later",
  });

  throw createError(error.value);
}

if (data.value) {
  formValue.value.name = data.value.metadata.name;
}

const applicationCategoryOptions =
  codeMetadataJSON.applicationCategoryOptions.map((option) => ({
    label: option,
    value: option,
  }));

const removeAuthor = (idx: number) => {
  formValue.value.authors.splice(idx, 1);
};

const handleValidateClick = (e: MouseEvent) => {
  e.preventDefault();
  formRef.value?.validate((errors) => {
    if (!errors) {
      push.success({
        title: "Valid",
        message: "Form is valid",
      });
    } else {
      console.log(errors);
      push.error({
        title: "Invalid",
        message: "Form is invalid",
      });
    }
  });
};
</script>

<template>
  <main class="mx-auto max-w-screen-xl p-8">
    <n-form
      ref="formRef"
      :label-width="80"
      :model="formValue"
      :rules="rules"
      size="large"
    >
      <LayoutLargeForm class="hidden">
        <template #info>
          <h2>Basic Information</h2>
        </template>

        <template #form>
          <n-card>
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
                v-model:value="formValue.creationDate as number"
                type="date"
              />
            </n-form-item>

            <n-form-item label="First Release Date" path="firstReleaseDate">
              <n-date-picker
                v-model:value="formValue.firstReleaseDate as number"
                type="date"
              />
            </n-form-item>
          </n-card>
        </template>
      </LayoutLargeForm>

      <LayoutLargeForm class="hidden">
        <template #info>
          <h2>Discoverability</h2>
        </template>

        <template #form>
          <n-card>
            <n-form-item label="Unique Identifier" path="uniqueIdentifier">
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
              >
              </n-select>
            </n-form-item>

            <n-form-item label="Keywords" path="keywords">
              <n-dynamic-input
                v-model:value="formValue.keywords"
                placeholder="Input Related Link"
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
        </template>
      </LayoutLargeForm>

      <LayoutLargeForm class="hidden">
        <template #info>
          <h2>Development Tools</h2>
        </template>

        <template #form>
          <n-card>
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
        </template>
      </LayoutLargeForm>

      <LayoutLargeForm class="hidden">
        <template #info>
          <h2>Run-time Environment</h2>
        </template>

        <template #form>
          <n-card>
            <n-form-item
              label="Programming Language"
              path="programmingLanguage"
            >
              <n-select
                v-model:value="formValue.programmingLanguages"
                placeholder="Select Category"
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
                placeholder="Select Category"
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
                placeholder="Select Category"
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
                placeholder="Input Related Link"
              />
            </n-form-item>
          </n-card>
        </template>
      </LayoutLargeForm>

      <LayoutLargeForm class="hidden">
        <template #info>
          <h2>Current version of the software</h2>
        </template>

        <template #form>
          <n-card>
            <n-form-item label="Current Version" path="currentVersion">
              <n-input
                v-model:value="formValue.currentVersion"
                placeholder="1.2.5"
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

            <n-form-item
              label="Creation Version Release Date"
              path="currentVersionReleaseDate"
            >
              <n-date-picker
                v-model:value="formValue.currentVersionReleaseDate as number"
                type="date"
              />
            </n-form-item>

            <n-form-item
              label="Current Version Download URL"
              path="currentVersionDownloadURL"
            >
              <n-input
                v-model:value="formValue.currentVersionDownloadURL"
                placeholder="https://example.com/download/1.0.0"
              />
            </n-form-item>

            <n-form-item
              label="Current Version Release Notes"
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
        </template>
      </LayoutLargeForm>

      <LayoutLargeForm class="hidden">
        <template #info>
          <h2>Additional Information</h2>
        </template>

        <template #form>
          <n-card>
            <n-form-item label="Development Status" path="developmentStatus">
              <n-select
                v-model:value="formValue.developmentStatus"
                placeholder="Select Category"
                :options="codeMetadataJSON.developmentStatusOptions"
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
        </template>
      </LayoutLargeForm>

      <LayoutLargeForm class="hidden">
        <template #info>
          <h2>Editorial Review</h2>
        </template>

        <template #form>
          <n-card>
            <n-form-item
              label="Reference Publication"
              path="referencePublication"
            >
              <n-input
                v-model:value="formValue.referencePublication"
                placeholder="Doe, J. (2023). Example Project. Journal of Examples."
              />
            </n-form-item>

            <n-form-item label="Review Aspect" path="reviewAspect">
              <n-input
                v-model:value="formValue.reviewAspect"
                placeholder="Code Quality"
              />
            </n-form-item>

            <n-form-item label="Review Body" path="reviewBody">
              <n-input
                v-model:value="formValue.reviewBody"
                placeholder="This project has been thoroughly reviewed for code quality."
                type="textarea"
                :rows="4"
              />
            </n-form-item>
          </n-card>
        </template>
      </LayoutLargeForm>

      <LayoutLargeForm class="">
        <template #info>
          <h2>Authors and Contributors</h2>
        </template>

        <template #form>
          <n-card>
            <n-flex vertical size="large">
              <CardCollapsible
                v-for="(author, index) in formValue.authors"
                :key="index"
                :title="
                  author.givenName
                    ? `${author.givenName} ${author.familyName}`
                    : `Author ${index + 1}`
                "
                bordered
              >
                <template #header-extra>
                  <n-popconfirm @positive-click="removeAuthor(index)">
                    <template #trigger>
                      <n-button type="error" secondary>
                        <template #icon>
                          <Icon name="ep:delete" />
                        </template>

                        Remove Author
                      </n-button>
                    </template>

                    Are you sure you want to remove this author?
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

                <n-form-item label="Email" :path="`authors[${index}].email`">
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

                <n-form-item label="URI" :path="`authors[${index}].uri`">
                  <n-input
                    v-model:value="author.uri"
                    placeholder="https://example.com/bertoltbrecht"
                    clearable
                  />
                </n-form-item>

                <n-flex vertical size="large">
                  <CardCollapsible
                    v-for="(role, roleIndex) in author.roles"
                    :key="roleIndex"
                    :title="role.role || `Role ${roleIndex + 1}`"
                    bordered
                  >
                    <template #header-extra>
                      <n-button
                        type="error"
                        @click="
                          formValue.authors[index].roles.splice(roleIndex, 1)
                        "
                      >
                        <template #icon>
                          <Icon name="ep:delete" />
                        </template>

                        Remove Role
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
                        v-model:value="role.startDate as number"
                        type="date"
                        clearable
                      />
                    </n-form-item>

                    <n-form-item
                      label="End Date"
                      :path="`authors[${index}].roles[${roleIndex}].endDate`"
                    >
                      <n-date-picker
                        v-model:value="role.endDate as number"
                        type="date"
                        clearable
                      />
                    </n-form-item>
                  </CardCollapsible>
                </n-flex>

                <n-button
                  @click="formValue.authors[index].roles.push({ role: '' })"
                >
                  <template #icon>
                    <Icon name="gridicons:user-add" />
                  </template>

                  Add Role
                </n-button>
              </CardCollapsible>

              <n-button
                type="primary"
                @click="
                  formValue.authors.push({
                    roles: [
                      {
                        role: '',
                      },
                    ],
                    givenName: '',
                  })
                "
              >
                <template #icon>
                  <Icon name="gridicons:user-add" />
                </template>

                Add Author
              </n-button>
            </n-flex>
          </n-card>

          <n-card>
            <n-form-item label="Contributors" path="contributors">
              <n-flex vertical size="large" class="w-full">
                <CardCollapsible
                  v-for="(contributor, index) in formValue.contributors"
                  :key="index"
                  :title="
                    contributor.givenName
                      ? `${contributor.givenName} ${contributor.familyName}`
                      : `Contributor ${index + 1}`
                  "
                  bordered
                >
                  <template #header-extra>
                    <n-popconfirm @positive-click="removeContributor(index)">
                      <template #trigger>
                        <n-button type="error" secondary>
                          <template #icon>
                            <Icon name="ep:delete" />
                          </template>

                          Remove Contributor
                        </n-button>
                      </template>

                      Are you sure you want to remove this contributor?
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

                  <n-form-item label="URI" :path="`contributors[${index}].uri`">
                    <n-input
                      v-model:value="contributor.uri"
                      placeholder="https://example.com/bertoltbrecht"
                      clearable
                    />
                  </n-form-item>

                  <n-flex vertical size="large">
                    <CardCollapsible
                      v-for="(role, roleIndex) in contributor.roles"
                      :key="roleIndex"
                      :title="role.role || `Role ${roleIndex + 1}`"
                      bordered
                    >
                      <template #header-extra>
                        <n-button
                          type="error"
                          @click="
                            formValue.contributors[index].roles.splice(
                              roleIndex,
                              1,
                            )
                          "
                        >
                          <template #icon>
                            <Icon name="ep:delete" />
                          </template>

                          Remove Role
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
                          v-model:value="role.startDate as number"
                          type="date"
                          clearable
                        />
                      </n-form-item>

                      <n-form-item
                        label="End Date"
                        :path="`contributors[${index}].roles[${roleIndex}].endDate`"
                      >
                        <n-date-picker
                          v-model:value="role.endDate as number"
                          type="date"
                          clearable
                        />
                      </n-form-item>
                    </CardCollapsible>
                  </n-flex>

                  <n-button
                    @click="
                      formValue.contributors[index].roles.push({ role: '' })
                    "
                  >
                    <template #icon>
                      <Icon name="gridicons:user-add" />
                    </template>

                    Add Role
                  </n-button>
                </CardCollapsible>

                <n-button
                  type="primary"
                  @click="
                    formValue.contributors.push({
                      roles: [
                        {
                          role: '',
                        },
                      ],
                      givenName: '',
                    })
                  "
                >
                  <template #icon>
                    <Icon name="gridicons:user-add" />
                  </template>

                  Add Contributor
                </n-button>
              </n-flex>
            </n-form-item>
          </n-card>
        </template>
      </LayoutLargeForm>

      <n-form-item>
        <n-button color="black" size="large" @click="handleValidateClick">
          <template #icon>
            <Icon name="grommet-icons:validate" />
          </template>
          Validate
        </n-button>
      </n-form-item>
    </n-form>

    <n-collapse class="mt-8">
      <n-collapse-item title="data" name="data">
        <pre>{{ data }}</pre>
      </n-collapse-item>

      <n-collapse-item title="formValue" name="formValue">
        <pre>{{ formValue }}</pre>
      </n-collapse-item>
    </n-collapse>
  </main>
</template>
