<script setup lang="ts">
import { Icon }  from "#components";
const user = useUser();
console.log(user);

// get the user access token from the db
const userToken = await $fetch("/api/user/token", {
  headers: useRequestHeaders(["cookie"]),
  method: "GET",
});

console.log(userToken);


const loggedIn = computed(() => !!user.value);
// // Get all the organizations the user is a member of
const orgFetch = await fetch(`https://api.github.com/user/orgs`, {
  headers: {
    Authorization: `Bearer ${userToken.access_token}`,
  },
});

if (!orgFetch.ok) {
  throw createError({
    statusCode: 400,
    statusMessage: "Something went wrong",
  });
}

console.log(orgFetch);

const organizationsOne = await orgFetch.json();

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
    statusMessage: "Something went wrong",
  });
}

const organizationsTwo = await orgDetails.json();

const combinedOrgs = [
    ...organizationsOne.map((org: any) => {
      return {
        id: org.id,
        name: org.login,
        avatar: org.avatar_url,
        description: org.description,
      };
    }),
    ...organizationsTwo.map((org: any) => {
      return {
        id: org.id,
        name: org.login,
        avatar: org.avatar_url,
        description: org.description,
      };
    }),
  ];

  const uniqueOrgs = combinedOrgs.filter(
    (org, index, self) => index === self.findIndex((t) => t.id === org.id),
  );

  console.log(uniqueOrgs);


async function logout() {
  await $fetch("/api/logout", {
    method: "POST",
  });
  window.location.href = "/";
}

const renderIcon = (icon: string) => {
  return () => {
    return h(Icon, { name: icon });
  };
}

const getOrgDetails = () => {

}

const orgChildren = uniqueOrgs.map((org: any) => {
  return {
    key: `/dashboard/${org.name}`,
    label: org.name,
    icon: () => h('img', { src: org.avatar ? org.avatar : `https://api.dicebear.com/9.x/identicon/svg?seed=${org.id}&backgroundColor=ffffff&backgroundType=gradientLinear`, alt: org.name, style: 'width: 24px; height: 24px; border-radius: 50%;' }),
  };
});

const settingOptions = [
  {
    icon: renderIcon("mdi:cog"),
    key: "switch-org",
    label: "Switch Organization",
    children: orgChildren,
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


const handleSettingsSelect = (key: any) => {
  console.log(key);
  switch (key) {
    case "view-codefair-settings":
      console.log("View Codefair Settings");
    case "view-profile":
      navigateTo("/profile");
      break;
    case "logout":
      logout();
      break;
    default:
      navigateTo(key);
  }
}
</script>

<template>
  <n-flex v-if="loggedIn" align="center">
    <n-dropdown :options="settingOptions" @select="handleSettingsSelect" placement="bottom-end" :show-arrow="true" class="bg-white shadow-md rounded-md">      
      <n-avatar round :src="`https://avatars.githubusercontent.com/u/${user?.github_id}?v=4`"
        :fallback-src="`https://api.dicebear.com/8.x/adventurer/svg?seed=${user?.github_id}`"
        class="transition-transform hover:scale-110 hover:shadow-sm hover:shadow-gray-400" />
    </n-dropdown>
  </n-flex>

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
