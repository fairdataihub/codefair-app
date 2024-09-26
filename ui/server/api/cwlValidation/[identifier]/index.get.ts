export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { identifier } = event.context.params as { identifier: string };

  const cwlValidationEntry = await prisma.cwlValidation.findFirst({
    include: {
      repository: true,
    },
    where: {
      identifier,
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
    identifier: cwlValidationEntry.identifier,
    owner: cwlValidationEntry.repository.owner,
    repo: cwlValidationEntry.repository.repo,
    updatedAt: Date.parse(cwlValidationEntry.updated_at.toString()),
  };

  return response;
});
