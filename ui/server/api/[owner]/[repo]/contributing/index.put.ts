import { z } from "zod";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    contribContent: z.string(),
  });

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  const body = await readBody(event);

  if (!body) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing required fields",
    });
  }

  const parsedBody = bodySchema.safeParse(body);

  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "The provided parameters are invalid",
    });
  }

  const { contribContent } = parsedBody.data;

  const contrib = await prisma.contributingValidation.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!contrib) {
    throw createError({
      statusCode: 404,
      statusMessage: "contributing request not found",
    });
  }

  // Check if the user is authorized to access the contributing request
  await repoWritePermissions(event, owner, repo);

  const updatedContribRequest = await prisma.readmeValidation.update({
    data: {
      readme_content: contribContent,
    },
    where: {
      id: contrib.id,
    },
  });

  if (!updatedContribRequest) {
    throw createError({
      statusCode: 500,
      statusMessage: "contributing-request-update-failed",
    });
  }

  return {
    contribContent,
  };
});
