export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  const licenseRequest = await prisma.licenseRequest.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!licenseRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "license-request-not-found",
    });
  }

  // Check if the user is authorized to access the license request
  await repoWritePermissions(event, owner, repo);

  const response: LicenseRequestGetResponse = {
    licenseId: licenseRequest.license_id,
    licenseContent: licenseRequest.license_content,
    identifier: licenseRequest.identifier,
    timestamp: Date.parse(licenseRequest.updated_at.toString()),
  };

  // return the valid license request
  return response;
});
