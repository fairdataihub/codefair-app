import { App } from "octokit";

let _app: App | null = null;

/**
 * Returns the GitHub App instance, initializing it on first call.
 * Reads `GH_APP_ID` and `GH_APP_PRIVATE_KEY` from the environment.
 * @throws {Error} If `GH_APP_PRIVATE_KEY` is not set.
 */
function getApp(): App {
  if (_app) return _app;
  if (!process.env.GH_APP_PRIVATE_KEY) {
    throw new Error("GH_APP_PRIVATE_KEY is not set");
  }
  _app = new App({
    appId: process.env.GH_APP_ID!,
    oauth: {
      clientId: null as unknown as string,
      clientSecret: null as unknown as string,
    },
    privateKey: process.env.GH_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  });
  return _app;
}

/**
 * Returns an installation-scoped Octokit client authenticated as the GitHub App.
 * The App instance is cached as a module-level singleton; per-installation tokens
 * are managed by the Octokit client internally.
 * @param installationId - The GitHub App installation ID to authenticate as.
 */
export function getInstallationOctokit(installationId: number) {
  return getApp().getInstallationOctokit(installationId);
}
