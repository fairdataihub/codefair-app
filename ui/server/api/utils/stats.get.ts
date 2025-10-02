// Fetch stats from database
// Return stats as JSON
export default defineEventHandler(async () => {
  try {
    const installations = await prisma.installation.findMany();
    const uniqueOwners = new Set(
      installations.map((installation) => installation.owner),
    );
    const uniqueOwnerCount = Math.floor(uniqueOwners.size / 5) * 5;
    const totalRepoCount = Math.floor(installations.length / 10) * 10;
    // If greater than or equal to 50, round to nearest 10
    return {
      totalRepoCount,
      uniqueOwnerCount,
    };
  } catch (error) {
    console.error("Error occurred while counting installations:", error);
    return {
      error: "Error occurred while counting installations",
      totalRepoCount: 0,
      uniqueOwnerCount: 0,
    };
  }
});
