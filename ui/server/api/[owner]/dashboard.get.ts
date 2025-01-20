export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner } = event.context.params as {
    owner: string;
  };

  if (!owner) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request. Missing owner in the URL params",
    });
  }

  const isOrg = await ownerIsOrganization(event, owner);
  await isOrganizationMember(event, isOrg, owner);

  // Get all installations for the owner
  const installations = await prisma.installation.findMany({
    where: {
      owner,
    },
  });

  return {
    installationId:
      installations.length > 0 ? installations[0].installation_id : null,
    isOrganization: isOrg,
    installations: installations.map((installation) => {
      return {
        action_count: installation.action_count as number,
        latestCommitDate: installation.latest_commit_date as string,
        latestCommitMessage: installation.latest_commit_message as string,
        latestCommitSha: installation.latest_commit_sha as string,
        latestCommitUrl: installation.latest_commit_url as string,
        repo: installation.repo as string,
        repositoryId: installation.id as number,
      };
    }),
  };
});
