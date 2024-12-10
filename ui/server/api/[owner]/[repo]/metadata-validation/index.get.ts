export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

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
      statusMessage: "metadata-validation-request-not-found",
    });
  }

  return {
    citationStatus: codeMetadataRequest.citation_status || "invalid",
    codemetaStatus: codeMetadataRequest.codemeta_status || "invalid",
    containsCitation: codeMetadataRequest.contains_citation || false,
    containsCodemeta: codeMetadataRequest.contains_codemeta || false,
    containsMetadata: codeMetadataRequest.contains_metadata || false,
    citationValidationMessage:
      codeMetadataRequest.citation_validation_message || "",
    codemetaValidationMessage:
      codeMetadataRequest.codemeta_validation_message || "",
    identifier: codeMetadataRequest.identifier || "",
    timestamp: codeMetadataRequest.updated_at || null,
  };
});
