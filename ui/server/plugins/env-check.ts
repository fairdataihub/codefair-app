import { logwatch } from "../utils/logwatch";

const REQUIRED_ENV_VARS = [
  "CODEFAIR_APP_DOMAIN",
  "GH_APP_ID",
  "GH_APP_NAME",
  "GH_APP_PRIVATE_KEY",
  "GH_OAUTH_APP_ID",
  "GH_OAUTH_CLIENT_ID",
  "GH_OAUTH_CLIENT_SECRET",
  "UI_LOGWATCH_URL",
  "VALIDATOR_URL",
  "WEBHOOK_SECRET",
  "ZENODO_API_ENDPOINT",
  "ZENODO_CLIENT_ID",
  "ZENODO_CLIENT_SECRET",
  "ZENODO_ENDPOINT",
  "ZENODO_REDIRECT_URI",
];

export default defineNitroPlugin(() => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(", ")}`;

    logwatch.error({
      action: "startup:env-check",
      message,
    });

    throw new Error(`[env-check] ${message}`);
  }
});
