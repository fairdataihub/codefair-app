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
    customLicenseTitle: licenseRequest.custom_license_title,
    customLicenseLanguage: licenseRequest.custom_license_language,
    timestamp: Date.parse(licenseRequest.updated_at.toString()),
  };

  // return the valid license request
  return response;
});
