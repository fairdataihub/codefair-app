export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  // Check if the user has write permissions to the repository
  await repoWritePermissions(event, owner, repo);
  const isOrg = await ownerIsOrganization(event, owner);
  await isOrganizationMember(event, isOrg, owner);

  // Check if the installation exists in the database
  const installation = await prisma.installation.findFirst({
    include: {
      CodeMetadata: true,
      CwlValidation: true,
      LicenseRequest: true,
    },
    where: {
      owner,
      repo,
    },
  });

  if (!installation) {
    throw createError({
      statusCode: 404,
      statusMessage: "installation-not-found",
    });
  }

  const licenseRequest = installation.LicenseRequest[0];
  const codeMetadataRequest = installation.CodeMetadata[0];
  const cwlValidation = installation.CwlValidation[0];

  return {
    codeMetadataRequest: codeMetadataRequest
      ? {
          citationStatus: codeMetadataRequest.citation_status || "invalid",
          codemetaStatus: codeMetadataRequest.codemeta_status || "invalid",
          containsCitation: codeMetadataRequest.contains_citation,
          containsCodemeta: codeMetadataRequest.contains_codemeta,
          containsMetadata: codeMetadataRequest.contains_metadata,
          identifier: codeMetadataRequest.identifier,
          owner: installation.owner,
          pullRequest: codeMetadataRequest.pull_request_url || "",
          repo: installation.repo,
          timestamp: codeMetadataRequest.updated_at,
        }
      : null,
    cwlValidation: cwlValidation
      ? {
          containsCWL: cwlValidation.contains_cwl_files,
          identifier: cwlValidation.identifier,
          overallStatus: cwlValidation.overall_status,
          owner: installation.owner,
          repo: installation.repo,
        }
      : null,
    installationId: installation.installation_id,
    isOrganization: isOrg,
    licenseRequest: licenseRequest
      ? {
          containsLicense: licenseRequest.contains_license || false,
          identifier: licenseRequest.identifier,
          licenseId: licenseRequest.license_id,
          licenseStatus: licenseRequest.license_status || "invalid",
          owner: installation.owner,
          pullRequest: licenseRequest.pull_request_url || "",
          repo: installation.repo,
          timestamp: licenseRequest.updated_at,
        }
      : null,
  };
});
