import { z } from "zod";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    codeContent: z.string(),
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

  const { codeContent } = parsedBody.data;

  const code = await prisma.codeofConductValidation.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!code) {
    throw createError({
      statusCode: 404,
      statusMessage: "Code of Conduct request not found",
    });
  }

  // Check if the user is authorized to access the license request
  await repoWritePermissions(event, owner, repo);

  const updatedCodeRequest = await prisma.codeofConductValidation.update({
    data: {
      code_content: codeContent,
    },
    where: {
      id: code.id,
    },
  });

  if (!updatedCodeRequest) {
    throw createError({
      statusCode: 500,
      statusMessage: "code-of-conduct-request-update-failed",
    });
  }

  return {
    codeContent,
  };
});
