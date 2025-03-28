import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function countInstallations() {
  try {
    // Retrieve all installation records from the PostgreSQL database
    const installations = await prisma.installation.findMany();

    // Count unique owners using a Set
    const uniqueOwners = new Set(
      installations.map((installation) => installation.owner),
    );
    const uniqueOwnerCount = uniqueOwners.size;

    // Each record represents one repository (via the "repo" field), so the total repo count is:
    const totalRepoCount = installations.length;

    console.log(`Unique owner count: ${uniqueOwnerCount}`);
    console.log(`Total repo count: ${totalRepoCount}`);
  } catch (error) {
    console.error("Error occurred while counting installations:", error);
  } finally {
    await prisma.$disconnect();
  }
}

countInstallations();
