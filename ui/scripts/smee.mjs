import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually so this works regardless of shell (cmd.exe / bash / PowerShell)
const envPath = resolve(process.cwd(), ".env");
try {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // No .env file — rely on existing process.env
}

const source = process.env.WEBHOOK_PROXY_URL;
if (!source) {
  // Exit cleanly: `yarn dev` runs this alongside Nuxt with npm-run-all, which
  // stops every task when one fails, so an error here would kill the UI too.
  console.warn(
    "WEBHOOK_PROXY_URL is not set in .env or environment; GitHub webhooks will not be forwarded.",
  );
  process.exit(0);
}

const target = "http://localhost:3000/api/webhooks/github";
console.log(`Forwarding ${source} → ${target}`);

const { default: SmeeClient } = await import("smee-client");
const smee = new SmeeClient({ logger: console, source, target });
smee.start();
