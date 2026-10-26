import type { AddressInfo } from "node:net";
import { defineNuxtModule, useLogger } from "nuxt/kit";

// Sign-in flows that send the user back to a URL from the env. Each URL must
// also be registered as a callback in that provider's app settings.
const CALLBACKS = [
  { name: "GitHub login", envVar: "CODEFAIR_APP_DOMAIN" },
  { name: "Zenodo sign-in", envVar: "ZENODO_REDIRECT_URI" },
];

/**
 * Returns the port a local callback URL points to.
 * @param value - The callback URL from the env.
 * @returns The port, or null when the URL is missing, invalid or not local.
 */
function localCallbackPort(value: string | undefined): number | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) return null;
    return Number(url.port) || (url.protocol === "https:" ? 443 : 80);
  } catch {
    return null;
  }
}

/**
 * Dev only: warns when the dev server is not on the port its sign-in
 * callbacks point to, since signing in to GitHub or Zenodo would then land
 * on the wrong server.
 */
export default defineNuxtModule({
  meta: { name: "dev-port-warning" },
  setup(_options, nuxt) {
    if (!nuxt.options.dev) return;

    const logger = useLogger("dev-port");

    nuxt.hook("listen", (server) => {
      const { port } = server.address() as AddressInfo;

      const mismatches = CALLBACKS.flatMap(({ name, envVar }) => {
        const expected = localCallbackPort(process.env[envVar]);
        return expected !== null && expected !== port
          ? [`${name} redirects to port ${expected} (${envVar})`]
          : [];
      });
      if (mismatches.length === 0) return;

      logger.warn(
        `The dev server is on port ${port}, but ${mismatches.join(" and ")}, ` +
          "so signing in will not work here. Free that port and restart the dev server, " +
          "or change the env variable together with the callback URL in the GitHub or Zenodo app settings.",
      );
    });
  },
});
