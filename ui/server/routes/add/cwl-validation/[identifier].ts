export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { identifier } = event.context.params as { identifier: string };

  // Get the cwl validation request from the database
  const cwlValidationRequest = await prisma.cwlValidation.findUnique({
    include: {
      repository: true,
    },
    where: {
      identifier,
    },
  });

  if (!cwlValidationRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "Request not found",
    });
  }

  // Redirect to the new license page
  return sendRedirect(
    event,
    `/dashboard/${cwlValidationRequest.repository.owner}/${cwlValidationRequest.repository.repo}/view/cwl-validation`,
  );
});
