/* eslint-disable no-console -- This maintenance script reports its progress to the operator. */
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
loadEnvFile(envPath);

if (!process.env.DATABASE_URL) {
  throw new Error(`DATABASE_URL is not defined in ${envPath}`);
}

const prisma = new PrismaClient();
const isDryRun = process.argv.includes("--dry-run");

async function activateCentralApi() {
  try {
    const pendingCount = await prisma.installation.count({
      where: { use_central_api: false },
    });

    console.log(`Installations with use_central_api = false: ${pendingCount}`);

    if (isDryRun) {
      console.log("Dry run — no changes written.");
      return;
    }

    const result = await prisma.installation.updateMany({
      data: { use_central_api: true },
      where: { use_central_api: false },
    });

    console.log(`Updated ${result.count} installation(s).`);

    const remainingCount = await prisma.installation.count({
      where: { use_central_api: false },
    });

    if (remainingCount > 0) {
      throw new Error(
        `${remainingCount} installation(s) still have use_central_api = false.`,
      );
    }

    console.log("All installations now use the central API.");
  } catch (error) {
    console.error("Error activating central API:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

await activateCentralApi();
