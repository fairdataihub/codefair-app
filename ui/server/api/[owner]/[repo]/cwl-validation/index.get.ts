export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  const cwlValidationEntry = await prisma.cwlValidation.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!cwlValidationEntry) {
    throw createError({
      statusCode: 404,
      statusMessage: "cwl-validation-request-not-found",
    });
  }

  const files = cwlValidationEntry.files as unknown as CWLValidationResults;

  const response: CWLValidationGetResponse = {
    createdAt: Date.parse(cwlValidationEntry.created_at.toString()),
    files,
    updatedAt: Date.parse(cwlValidationEntry.updated_at.toString()),
  };

  return response;
});
