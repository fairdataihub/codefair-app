export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  // Check if the user has write permissions to the repository
  await repoWritePermissions(event, owner, repo);

  const isOrg = await ownerIsOrganization(event, owner);
  await isOrganizationMember(event, isOrg, owner);

  const zenodoDeposition = await prisma.zenodoDeposition.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!zenodoDeposition) {
    throw createError({
      statusCode: 404,
      statusMessage: "Zenodo deposition not found",
    });
  }

  // console.log("zenodoDeposition.status", zenodoDeposition.status);

  return {
    zenodoDoi: zenodoDeposition.last_published_zenodo_doi || "",
    zenodoWorkflowStatus: zenodoDeposition.status || "",
  };
});
