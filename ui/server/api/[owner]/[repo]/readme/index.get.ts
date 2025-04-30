export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  const readme = await prisma.readmeValidation.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!readme) {
    throw createError({
      statusCode: 404,
      statusMessage: "readme-request-not-found",
    });
  }

  // Check if the user is authorized to access the readme request
  await repoWritePermissions(event, owner, repo);

  const response: ReadmeRequestGetResponse = {
    readmeContent: readme.readme_content || "",
    timestamp: Date.parse(readme.updated_at.toString()),
  };

  // return the valid readme request
  return response;
});
