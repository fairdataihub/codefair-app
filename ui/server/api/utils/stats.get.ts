// Fetch stats from database
// Return stats as JSON
export default defineEventHandler(async () => {
  try {
    const installations = await prisma.installation.findMany();
    const uniqueOwners = new Set(
      installations.map((installation) => installation.owner),
    );
    let uniqueOwnerCount = uniqueOwners.size;
    const totalRepoCount = Math.floor(installations.length / 10) * 10;
    // If greater than or equal to 50, round to nearest 10
    if (uniqueOwnerCount >= 50) {
      uniqueOwnerCount = Math.floor(uniqueOwnerCount / 10) * 10;
    }
    return {
      totalRepoCount,
      uniqueOwnerCount,
    };
  } catch (error) {
    console.error("Error occurred while counting installations:", error);
    return { error: "Error occurred while counting installations" };
  }
});
