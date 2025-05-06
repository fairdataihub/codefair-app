import { createId } from "@paralleldrive/cuid2";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  const installation = await prisma.installation.findFirst({
    include: {
      ReadmeValidation: true,
    },
    where: {
      owner,
      repo,
    },
  });

  if (!installation) {
    throw createError({
      statusCode: 404,
      statusMessage: "installation-not-found",
    });
  }

  let readme = installation?.ReadmeValidation;

  if (!readme) {
    // Create entry if it doesn't exist
    readme = await prisma.readmeValidation.create({
      data: {
        contains_readme: false,
        identifier: createId(),
        repository: {
          connect: {
            id: installation.id,
          },
        },
      },
    });
  }

  // Check if the user is authorized to access the readme request
  await repoWritePermissions(event, owner, repo);

  const response: ReadmeRequest = {
    readmeContent: readme?.readme_content || "",
  };

  // return the valid readme request
  return response;
});
