import { createId } from "@paralleldrive/cuid2";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  const installation = await prisma.installation.findFirst({
    include: {
      ContributingValidation: true,
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

  let contrib = installation.ContributingValidation;

  if (!contrib) {
    // Create entry if it doesn't exist
    contrib = await prisma.contributingValidation.create({
      data: {
        contains_contrib: false,
        identifier: createId(),
        repository: {
          connect: {
            id: installation.id,
          },
        },
      },
    });
  }

  // Check if the user is authorized to access the request
  await repoWritePermissions(event, owner, repo);

  return {
    contribContent: contrib?.contrib_content || "",
  };
});
