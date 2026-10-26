import type { AddressInfo } from "node:net";
import type { SmeeClient } from "smee-client";
import { defineNuxtModule, useLogger } from "nuxt/kit";

/**
 * Dev only: forwards GitHub webhooks from the smee.io channel in
 * `WEBHOOK_PROXY_URL` to this dev server. The target uses the port the server
 * actually started on, since Nuxt moves to another port when the requested one
 * is taken.
 */
export default defineNuxtModule({
  meta: { name: "smee" },
  setup(_options, nuxt) {
    if (!nuxt.options.dev) return;

    const logger = useLogger("smee");
    let smee: SmeeClient | undefined;

    nuxt.hook("listen", async (server) => {
      const source = process.env.WEBHOOK_PROXY_URL;
      if (!source) {
        logger.warn(
          "WEBHOOK_PROXY_URL is not set in .env or environment; GitHub webhooks will not be forwarded.",
        );
        return;
      }

      const { port } = server.address() as AddressInfo;
      const target = `http://localhost:${port}/api/webhooks/github`;
      logger.info(`Forwarding ${source} → ${target}`);

      const { SmeeClient: Client } = await import("smee-client");
      smee = new Client({ logger: console, source, target });
      // A failed connection must not take down the dev server
      smee.start().catch((error) => {
        logger.warn("Could not connect to the smee.io channel:", error);
      });
    });

    // Nuxt closes the old instance before restarting, so stop its forwarder
    nuxt.hook("close", async () => {
      await smee?.stop();
      smee = undefined;
    });
  },
});
