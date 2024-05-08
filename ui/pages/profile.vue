<script setup lang="ts">
definePageMeta({
  //   layout: "public",
  middleware: ["protected"],
});
const user = useUser();
</script>

<template>
  <section class="mx-auto max-w-screen-xl p-4">
    <n-flex vertical>
      <h1>Profile</h1>

      <p>This is all the information we know about you.</p>
    </n-flex>

    <Card>
      <template #title>GitHub Username</template>

      <template #content>
        <p class="m-0">
          Lorem ipsum dolor sit amet, consectetur adipisicing elit. Inventore
          sed consequuntur error repudiandae numquam deserunt quisquam repellat
          libero asperiores earum nam nobis, culpa ratione quam perferendis
          esse, cupiditate neque quas!
        </p>
      </template>
    </Card>

    <p>This is all the information we know about you</p>

    <pre>{{ user }}</pre>

    <!-- <pre>{{ user.username }}</pre> -->
    <!-- <ProfileStatus /> -->
  </section>
</template>
