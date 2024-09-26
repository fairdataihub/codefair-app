import { setup } from "@css-render/vue3-ssr";
import { defineNuxtPlugin, type NuxtSSRContext } from "#app";

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server) {
    const { collect } = setup(nuxtApp.vueApp);
    const originalRenderMeta = nuxtApp.ssrContext?.renderMeta;

    nuxtApp.ssrContext = nuxtApp.ssrContext || ({} as NuxtSSRContext);
    nuxtApp.ssrContext.renderMeta = () => {
      if (!originalRenderMeta) {
        return {
          headTags: collect(),
        };
      }
      const originalMeta =
        typeof originalRenderMeta === "function"
          ? originalRenderMeta()
          : originalRenderMeta;
      if ("then" in originalMeta) {
        return originalMeta.then((resolvedOriginalMeta: any) => {
          return {
            ...resolvedOriginalMeta,
            headTags: resolvedOriginalMeta["headTags"] + collect(),
          };
        });
      } else {
        return {
          ...originalMeta,
          headTags: originalMeta["headTags"] + collect(),
        };
      }
    };

    nuxtApp.ssrContext.head =
      nuxtApp.ssrContext.head || ([] as typeof nuxtApp.ssrContext.head);
    nuxtApp.ssrContext.head.push({
      style: () =>
        collect()
          .split("</style>")
          .map((block) => {
            const id = RegExp(/cssr-id="(.+?)"/).exec(block)?.[1];
            const style = (RegExp(/>(.*)/s).exec(block)?.[1] ?? "").trim();
            return {
              "cssr-id": id,
              innerHTML: style,
            };
          }),
    });
  }
});
