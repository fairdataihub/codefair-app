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

  const rawMetadata: any = codeMetadataRequest.metadata;

  // to do conversions on the metadata if needed
  if (rawMetadata.authors) {
    // Ensure all authors have a roles array
    rawMetadata.authors.map((author: any) => {
      if (!author.roles) {
        author.roles = [];
      }
      return author;
    });
  }

  if (rawMetadata.contributors) {
    // Ensure all contributors have a roles array
    rawMetadata.contributors.map((contributor: any) => {
      if (!contributor.roles) {
        contributor.roles = [];
      }
      return contributor;
    });
  }

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
