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

  // Check if the user is authorized to access the readme request
  await repoWritePermissions(event, owner, repo);

  const response: ReadmeRequest = {
    readmeContent: readme?.readme_content || "",
  };

  // return the valid readme request
  return response;
});
