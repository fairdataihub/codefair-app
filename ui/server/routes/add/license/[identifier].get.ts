export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { identifier } = event.context.params as { identifier: string };

  // Get the license request from the database
  const licenseRequest = await prisma.licenseRequest.findUnique({
    where: {
      identifier,
    },
    include: {
      repository: true,
    },
  });

  if (!licenseRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "License request not found",
    });
  }

  // Redirect to the new license page
  return sendRedirect(
    event,
    `/dashboard/${licenseRequest.repository.owner}/${licenseRequest.repository.repo}/edit/license`,
  );
});
