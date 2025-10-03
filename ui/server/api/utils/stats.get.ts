// Fetch stats from database
// Return stats as JSON
export default defineEventHandler(async () => {
  try {
    const installations = await prisma.installation.findMany({
      distinct: ["owner"],
      select: { owner: true },
    });
    const uniqueOwnerCountRaw = installations.length;
    const uniqueOwnerCount = Math.floor(uniqueOwnerCountRaw / 5) * 5;

    const totalInstallations = await prisma.installation.count();
    const totalRepoCount = Math.floor(totalInstallations / 10) * 10;

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
