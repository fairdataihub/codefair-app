<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

// The middleware only hides the page. Every /api/admin route checks the
// admin role on the server, so nothing here is reachable by anyone else.
definePageMeta({
  middleware: ["admin"],
});

useHead({
  title: "Admin",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
});

const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.hideBreadcrumbs();

const activeTab = ref("maintenance");

// Every change made from a panel adds an audit entry
const onChanged = async () => {
  await refreshNuxtData("admin-audit-log");
};
</script>

<template>
  <section class="mx-auto max-w-screen-xl p-4">
    <n-flex vertical>
      <h1>Admin</h1>

      <p>
        Manage Codefair without a redeploy. Every change made here is recorded
        in the audit log.
      </p>
    </n-flex>

    <LayoutSectionDivider class="my-6" />

    <n-tabs v-model:value="activeTab" type="line" animated>
      <n-tab-pane name="maintenance" tab="Maintenance" display-directive="show">
        <AdminMaintenancePanel @changed="onChanged" />
      </n-tab-pane>

      <n-tab-pane name="admins" tab="Admins" display-directive="show">
        <AdminAdminsPanel @changed="onChanged" />
      </n-tab-pane>

      <n-tab-pane name="audit" tab="Audit log" display-directive="show">
        <AdminAuditLog />
      </n-tab-pane>
    </n-tabs>
  </section>
</template>
