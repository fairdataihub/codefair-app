<script setup lang="ts">
import { ref, computed, h } from "vue";

import { Icon } from "#components";

// User-related states and utilities
const user = useUser();
console.log(user);

const loggedIn = computed(() => !!user.value);
const loading = ref(true); // Tracks loading state for data fetching

// Utility to render icons
const renderIcon = (icon: string) => {
  return () => h(Icon, { name: icon });
};

type DropdownOption = {
  children?: DropdownOption[];
  icon: () => VNode;
  key: string;
  label: string;
};

const settingOptions = ref<DropdownOption[]>([]);

// Fetch user data and organizations if logged in
// TODO: Consider if there are methods to improve perfomance as this is called on every page load
if (loggedIn.value) {
  try {
    // TODO: Convert all this to a api function call
    // Get the user access token from the database
    const userToken = await $fetch("/api/user/token", {
      headers: useRequestHeaders(["cookie"]),
      method: "GET",
    });

    // Fetch the organizations the user is a member of
    const orgFetch = await fetch(`https://api.github.com/user/orgs`, {
      headers: {
        Authorization: `Bearer ${userToken.access_token}`,
      },
    });

    if (!orgFetch.ok) {
      throw createError({
        statusCode: 400,
        statusMessage: "Failed to fetch user organizations",
      });
    }

    const organizationsOne = await orgFetch.json();

    // Fetch additional organization details
    const orgDetails = await fetch(
      `https://api.github.com/users/${user.value?.username}/orgs`,
      {
        headers: {
          Authorization: `Bearer ${userToken.access_token}`,
        },
      },
    );

    if (!orgDetails.ok) {
      throw createError({
        statusCode: 400,
        statusMessage: "Failed to fetch user organization details",
      });
    }

    const organizationsTwo = await orgDetails.json();

    // Combine and deduplicate organizations
    const combinedOrgs = [
      ...organizationsOne.map((org: any) => ({
        id: org.id,
        name: org.login,
        avatar: org.avatar_url,
        description: org.description,
      })),
      ...organizationsTwo.map((org: any) => ({
        id: org.id,
        name: org.login,
        avatar: org.avatar_url,
        description: org.description,
      })),
    ];

    const uniqueOrgs = combinedOrgs.filter(
      (org, index, self) => index === self.findIndex((t) => t.id === org.id),
    );

    // Include user information in the uniqueOrgs array
    // Add a border to separate user from organizations

    uniqueOrgs.unshift({
      id: user.value?.github_id,
      name: user.value?.username,
      avatar: `https://avatars.githubusercontent.com/u/${user.value?.github_id}?v=4`,
      description: "Your personal account",
    });

    // Map organizations to dropdown options
    let count = 0;
    const orgChildren: any[] = [];
    uniqueOrgs.forEach((org: any) => {
      if (count === 1) {
        orgChildren.push({
          key: `d1`,
          type: "divider",
        });
      }
      orgChildren.push({
        icon: () =>
          h("img", {
            alt: org.name,
            src: org.avatar
              ? org.avatar
              : `https://api.dicebear.com/9.x/identicon/svg?seed=${org.id}&backgroundColor=ffffff&backgroundType=gradientLinear`,
            style: "width: 24px; height: 24px; border-radius: 50%;",
          }),
        key: `/dashboard/${org.name}`,
        label: org.name,
      });
      count++;
    });

    // Update settingOptions with organizations
    settingOptions.value = [
      {
        children: orgChildren,
        icon: renderIcon("mdi:cog"),
        key: "switch-org",
        label: "Switch Organization",
      },
      {
        icon: renderIcon("mdi:account"),
        key: "view-profile",
        label: "View Profile",
      },
      {
        icon: renderIcon("mdi:logout"),
        key: "logout",
        label: "Logout",
      },
    ];
  } catch (error) {
    console.error("Error fetching organizations or user data:", error);
  } finally {
    loading.value = false;
  }
} else {
  loading.value = false; // Set loading to false if not logged in
}

// Handle dropdown item selection
const handleSettingsSelect = (key: string) => {
  console.log("Selected:", key);
  switch (key) {
    case "view-profile":
      navigateTo("/profile");
      break;
    case "logout":
      logout();
      break;
    default:
      navigateTo(key); // Navigate to organization-specific dashboard
  }
};

// Logout function
async function logout() {
  await $fetch("/api/logout", {
    method: "POST",
  });

  user.value = null; // Clear user state
  navigateTo("/"); // Redirect to home
}
</script>

<template>
  <!-- Display if user is logged in -->
  <n-flex v-if="loggedIn" align="center">
    <n-dropdown
      :options="settingOptions"
      placement="bottom-end"
      :show-arrow="true"
      class="rounded-md bg-white shadow-md"
      @select="handleSettingsSelect"
    >
      <!-- User Avatar -->
      <n-avatar
        v-if="user?.github_id"
        round
        :src="`https://avatars.githubusercontent.com/u/${user?.github_id}?v=4`"
        :fallback-src="`https://api.dicebear.com/8.x/adventurer/svg?seed=${user?.github_id}`"
        class="transition-transform hover:scale-110 hover:shadow-sm hover:shadow-gray-400"
      />
    </n-dropdown>
  </n-flex>

  <!-- Loading spinner while fetching data -->
  <div v-else-if="loading" class="flex items-center justify-center">
    <n-spin size="large" />
  </div>

  <!-- Login button if user is not logged in -->
  <div v-else>
    <a href="/login/github">
      <n-button color="black">
        <template #icon>
          <Icon name="bi:github" />
        </template>
        Sign in with GitHub
      </n-button>
    </a>
  </div>
</template>
