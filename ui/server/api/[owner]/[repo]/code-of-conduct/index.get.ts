import { createId } from "@paralleldrive/cuid2";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  const installation = await prisma.installation.findFirst({
    include: {
      CodeofConductValidation: true,
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

  let code = installation?.CodeofConductValidation;

  if (!code) {
    // Create entry if it doesn't exist
    code = await prisma.codeofConductValidation.create({
      data: {
        contains_code: false,
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
    codeContent: code?.code_content || "",
  };
});
