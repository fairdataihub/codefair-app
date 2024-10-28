export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  // Check if the request identifier exists in the database
  const codeMetadataRequest = await prisma.codeMetadata.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!codeMetadataRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "codemetadata-request-not-found",
    });
  }

  // Check if the user is authorized to access the codeMetadata request
  await repoWritePermissions(event, owner, repo);

  const rawMetadata = codeMetadataRequest.metadata;

  // to do conversions on the metadata if needed
  // -- none for now --

  const parsedMetadata = rawMetadata as unknown as CodeMetadataRequest;

  const response: CodeMetadataRequestGetResponse = {
    createdAt: Date.parse(codeMetadataRequest.created_at.toString()),
    identifier: codeMetadataRequest.identifier,
    metadata: parsedMetadata,
    updatedAt: Date.parse(codeMetadataRequest.updated_at.toString()),
  };

  // return the valid license request
  return response;
});
