import { runComplianceChecks } from "../../compliance-checks/index.js";
import { renderIssues, createIssue } from "../../utils/renderer/index.js";
import dbInstance from "../../db.js";
import { logwatch } from "../../utils/logwatch.js";
import { applyLastModifiedTemplate } from "../../utils/tools/index.js";
import { validateLicense } from "../../compliance-checks/license/index.js";
import { getCWLFiles } from "../../compliance-checks/cwl/index.js";
import {
  validateMetadata,
  getCitationContent,
  getCodemetaContent,
  gatherMetadata,
  convertDateToUnix,
  applyDbMetadata,
  applyCodemetaMetadata,
  applyCitationMetadata,
} from "../../compliance-checks/metadata/index.js";

const ISSUE_TITLE = `FAIR Compliance Dashboard`;
const db = dbInstance;

export async function rerunMetadataValidation(
  context,
  owner,
  repository,
  issueBody
) {
  logwatch.start("Validating metadata files...");
  try {
    let metadata = await gatherMetadata(context, owner, repository);
    let containsCitation = false,
      containsCodemeta = false,
      validCitation = false,
      validCodemeta = false;

    const existingMetadataEntry = await db.codeMetadata.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (existingMetadataEntry?.metadata) {
      // Update the metadata variable
      containsCitation = existingMetadataEntry.contains_citation;
      containsCodemeta = existingMetadataEntry.contains_codemeta;
      metadata = applyDbMetadata(existingMetadataEntry, metadata);
    }

    const citation = await getCitationContent(context, owner, repository);
    const codemeta = await getCodemetaContent(context, owner, repository);

    if (codemeta) {
      containsCodemeta = true;
      validCodemeta = await validateMetadata(codemeta, "codemeta", repository);
      metadata = await applyCodemetaMetadata(codemeta, metadata, repository);
    }

    if (citation) {
      containsCitation = true;
      validCitation = await validateMetadata(citation, "citation", repository);
      metadata = await applyCitationMetadata(citation, metadata, repository);
      // consola.info("Metadata so far after citation update", JSON.stringify(metadata, null, 2));
    }

    // Ensure all dates have been converted to ISO strings split by the T
    if (metadata.creationDate) {
      metadata.creationDate = convertDateToUnix(metadata.creationDate);
    }
    if (metadata.firstReleaseDate) {
      metadata.firstReleaseDate = convertDateToUnix(metadata.firstReleaseDate);
    }
    if (metadata.currentVersionReleaseDate) {
      metadata.currentVersionReleaseDate = convertDateToUnix(
        metadata.currentVersionReleaseDate
      );
    }

    // update the database with the metadata information
    if (existingMetadataEntry) {
      await db.codeMetadata.update({
        data: {
          codemeta_status: validCodemeta ? "valid" : "invalid",
          citation_status: validCitation ? "valid" : "invalid",
          contains_citation: containsCitation,
          contains_codemeta: containsCodemeta,
          metadata: metadata,
        },
        where: {
          repository_id: repository.id,
        },
      });
    } else {
      await db.codeMetadata.create({
        data: {
          codemeta_status: validCodemeta ? "valid" : "invalid",
          citation_status: validCitation ? "valid" : "invalid",
          contains_citation: containsCitation,
          contains_codemeta: containsCodemeta,
          metadata: metadata,
        },
        where: {
          repository_id: repository.id,
        },
      });
    }

    const issueBodyRemovedCommand = issueBody.substring(
      0,
      issueBody.indexOf(`<sub><span style="color: grey;">Last updated`)
    );
    const lastModified = await applyLastModifiedTemplate(
      issueBodyRemovedCommand
    );
    await createIssue(context, owner, repository, ISSUE_TITLE, lastModified);
  } catch (error) {
    // Remove the command from the issue body
    const issueBodyRemovedCommand = issueBody.substring(
      0,
      issueBody.indexOf(`<sub><span style="color: grey;">Last updated`)
    );
    const lastModified = await applyLastModifiedTemplate(
      issueBodyRemovedCommand
    );
    await createIssue(context, owner, repository, ISSUE_TITLE, lastModified);
    if (error.cause) {
      logwatch.error(
        {
          message: "Error.cause message for Metadata Validation",
          error: error.cause,
        },
        true
      );
    }
    throw new Error("Error rerunning metadata validation", error);
  }
}

export async function rerunLicenseValidation(
  context,
  owner,
  repository,
  issueBody
) {
  // Run the license validation again
  logwatch.start("Rerunning License Validation...");
  try {
    const licenseRequest = await context.octokit.rest.licenses.getForRepo({
      owner,
      repo: repository.name,
    });

    const existingLicense = await db.licenseRequest.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    const license = !!licenseRequest.data.license;

    if (!license) {
      throw new Error("License not found in the repository");
    }

    const { licenseId, licenseContent, licenseContentEmpty } = validateLicense(
      licenseRequest,
      existingLicense
    );

    logwatch.info({
      message: `License validation complete`,
      licenseId,
      licenseContent,
      licenseContentEmpty,
    });

    // Update the database with the license information
    if (existingLicense) {
      await db.licenseRequest.update({
        data: {
          license_id: licenseId,
          license_content: licenseContent,
          license_status: licenseContentEmpty ? "invalid" : "valid",
        },
        where: {
          repository_id: repository.id,
        },
      });
    } else {
      await db.licenseRequest.create({
        data: {
          license_id: licenseId,
          license_content: licenseContent,
          license_status: licenseContentEmpty ? "invalid" : "valid",
        },
        where: {
          repository_id: repository.id,
        },
      });
    }

    // Update the issue body
    const issueBodyRemovedCommand = issueBody.substring(
      0,
      issueBody.indexOf(`<sub><span style="color: grey;">Last updated`)
    );
    const lastModified = await applyLastModifiedTemplate(
      issueBodyRemovedCommand
    );
    await createIssue(context, owner, repository, ISSUE_TITLE, lastModified);
  } catch (error) {
    // Remove the command from the issue body
    const issueBodyRemovedCommand = issueBody.substring(
      0,
      issueBody.indexOf(`<sub><span style="color: grey;">Last updated`)
    );
    const lastModified = await applyLastModifiedTemplate(
      issueBodyRemovedCommand
    );
    await createIssue(context, owner, repository, ISSUE_TITLE, lastModified);
    if (error.cause) {
      logwatch.error(
        {
          message: "Error.cause message for License Validation",
          error: error.cause,
        },
        true
      );
    }
    throw new Error("Error rerunning license validation", error);
  }
}

export async function rerunCWLValidation(context, owner, repository) {
  try {
    logwatch.start("Rerunning CWL Validation...");

    const [licenseResponse, metadataResponse, cwlResponse] = await Promise.all([
      db.licenseRequest.findUnique({
        where: {
          repository_id: repository.id,
        },
      }),
      db.codeMetadata.findUnique({
        where: {
          repository_id: repository.id,
        },
      }),
    ]);

    const license = !!licenseResponse?.license_id;
    const citation = !!metadataResponse?.contains_citation;
    const codemeta = !!metadataResponse?.contains_codemeta;

    const cwlObject = await getCWLFiles(context, owner, repository);

    const subjects = {
      cwl: cwlObject,
      citation,
      codemeta,
      license,
    };

    const issueBody = await renderIssues(
      context,
      owner,
      repository,
      false,
      subjects
    );

    await createIssue(context, owner, repository, ISSUE_TITLE, issueBody);

    logwatch.info("CWL Validation rerun successfully!");
  } catch (error) {
    // Remove the command from the issue body
    const issueBodyRemovedCommand = issueBody.substring(
      0,
      issueBody.indexOf(`<sub><span style="color: grey;">Last updated`)
    );
    const lastModified = await applyLastModifiedTemplate(
      issueBodyRemovedCommand
    );
    await createIssue(context, owner, repository, ISSUE_TITLE, lastModified);
    if (error.cause) {
      logwatch.error(
        {
          message: "Error.cause message for CWL Validation",
          error_cause: error.cause,
          error: error,
        },
        true
      );
    }
    throw new Error("Error rerunning cwl validation", error);
  }
}

export async function rerunFullRepoValidation(context, owner, repository) {
  logwatch.start("Rerunning full repository validation...");
  try {
    let subjects = await runComplianceChecks(context, owner, repository);

    const issueBody = await renderIssues(
      context,
      owner,
      repository,
      false,
      subjects
    );

    await createIssue(context, owner, repository, ISSUE_TITLE, issueBody);
  } catch (error) {
    // Remove the command from the issue body
    const issueBodyRemovedCommand = issueBody.substring(
      0,
      issueBody.indexOf(`<sub><span style="color: grey;">Last updated`)
    );
    const lastModified = await applyLastModifiedTemplate(
      issueBodyRemovedCommand
    );
    await createIssue(context, owner, repository, ISSUE_TITLE, lastModified);
    logwatch.error(
      {
        message: "Error for Full Repo Validation",
        error: error,
        error_cause: error?.cause,
      },
      true
    );
    throw new Error("Error rerunning full repo validation", error);
  }
}
