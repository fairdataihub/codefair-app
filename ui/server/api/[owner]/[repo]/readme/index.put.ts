import { z } from "zod";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    readmeContent: z.string(),
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

  const { readmeContent } = parsedBody.data;

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
      statusMessage: "README request not found",
    });
  }

  // Check if the user is authorized to access the license request
  await repoWritePermissions(event, owner, repo);

  const updatedReadmeRequest = await prisma.readmeValidation.update({
    data: {
      readme_content: readmeContent,
    },
    where: {
      id: readme.id,
    },
  });

  if (!updatedReadmeRequest) {
    throw createError({
      statusCode: 500,
      statusMessage: "readme-request-update-failed",
    });
  }

  return {
    readmeContent,
  };
});
