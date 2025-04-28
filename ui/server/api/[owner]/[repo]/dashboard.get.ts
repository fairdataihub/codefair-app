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
      ZenodoDeposition: true,
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

  const licenseRequest = installation.LicenseRequest;
  const codeMetadataRequest = installation.CodeMetadata;
  const cwlValidation = installation.CwlValidation;
  const zenodoDeposition = installation.ZenodoDeposition;

  return {
    codeMetadataRequest: codeMetadataRequest
      ? {
          citationStatus: codeMetadataRequest.citation_status || "invalid",
          citationValidationMessage:
            codeMetadataRequest.citation_validation_message || "",
          codemetaStatus: codeMetadataRequest.codemeta_status || "invalid",
          codemetaValidationMessage:
            codeMetadataRequest.codemeta_validation_message || "",
          containsCitation: codeMetadataRequest.contains_citation || false,
          containsCodemeta: codeMetadataRequest.contains_codemeta || false,
          containsMetadata: codeMetadataRequest.contains_metadata || false,
          identifier: codeMetadataRequest.identifier || "",
          owner: installation.owner,
          pullRequest: codeMetadataRequest.pull_request_url || "",
          repo: installation.repo,
          timestamp: codeMetadataRequest.updated_at || null,
        }
      : null,
    cwlValidation: cwlValidation
      ? {
          containsCWL: cwlValidation.contains_cwl_files || false,
          identifier: cwlValidation.identifier || "",
          overallStatus: cwlValidation.overall_status || "",
          owner: installation.owner,
          repo: installation.repo,
        }
      : null,
    installationId: installation.installation_id,
    isOrganization: isOrg,
    licenseRequest: licenseRequest
      ? {
          containsLicense: licenseRequest.contains_license || false,
          identifier: licenseRequest.identifier || "",
          licenseId: licenseRequest.license_id || null,
          licenseStatus: licenseRequest.license_status || "invalid",
          owner: installation.owner,
          pullRequest: licenseRequest.pull_request_url || "",
          repo: installation.repo,
          timestamp: licenseRequest.updated_at || null,
        }
      : null,
    zenodoDeposition: zenodoDeposition
      ? {
          lastPublishedZenodoDoi:
            zenodoDeposition.last_published_zenodo_doi || null,
          zenodoId: zenodoDeposition.zenodo_id || null,
          zenodoStatus: zenodoDeposition.status || null,
        }
      : null,
  };
});
