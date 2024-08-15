import { defineStore } from "pinia";

export const useBreadcrumbsStore = defineStore("Breadcrumbs", () => {
  const shouldShowBreadcrumbs = ref(false);

  const owner = ref("");
  const repo = ref("");

  const feature = ref({
    id: "",
    name: "",
    icon: "",
  });

  const showBreadcrumbs = () => {
    shouldShowBreadcrumbs.value = true;
  };

  const hideBreadcrumbs = () => {
    shouldShowBreadcrumbs.value = false;
  };

  const setOwner = (newOwner: string) => {
    owner.value = newOwner;
  };

  const setRepo = (newRepo: string) => {
    repo.value = newRepo;
  };

  const setFeature = (newFeature: any) => {
    feature.value = newFeature;
  };

  return {
    feature,
    hideBreadcrumbs,
    owner,
    repo,
    setFeature,
    setOwner,
    setRepo,
    shouldShowBreadcrumbs,
    showBreadcrumbs,
  };
});
