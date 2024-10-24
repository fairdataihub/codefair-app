export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { identifier } = event.context.params as { identifier: string };

  // Get the codemetadata request from the database
  const codeMetadataRequest = await prisma.codeMetadata.findUnique({
    include: {
      repository: true,
    },
    where: {
      identifier,
    },
  });

  if (!codeMetadataRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "Code Metadata request not found",
    });
  }

  // Redirect to the new license page
  return sendRedirect(
    event,
    `/dashboard/${codeMetadataRequest.repository.owner}/${codeMetadataRequest.repository.repo}/edit/code-metadata`,
  );
});
