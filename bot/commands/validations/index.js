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
import { checkForReadme } from "../../compliance-checks/readme/index.js";
import { createId } from "../../utils/tools/index.js";
import { checkForCodeofConduct } from "../../compliance-checks/code-of-conduct/index.js";
import { checkForContributingFile } from "../../compliance-checks/contributing/index.js";

const ISSUE_TITLE = `FAIR Compliance Dashboard`;
const db = dbInstance;

export async function rerunReadmeValidation(
  context,
  owner,
  repository,
  issueBody
) {
  logwatch.start("Refetching README file...");
  try {
    const readme = await checkForReadme(context, owner, repository.name);
    const existingReadmeEntry = await db.readmeValidation.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (existingReadmeEntry) {
      // Update the entry
      await db.readmeValidation.update({
        data: {
          readme_path: readme.path,
          readme_content: readme.content,
          contains_readme: readme.status,
        },
        where: {
          repository_id: repository.id,
        },
      });
    } else {
      // Create a new entry
      await db.readmeValidation.create({
        data: {
          readme_path: readme.path,
          readme_content: readme.content,
          contains_readme: readme.status,
          repository: {
            connect: {
              id: repository.id,
            },
          },
        },
      });
    }
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
          message: "Error.cause message for fetching README file",
          error_cause: error.cause,
          error: error,
        },
        true
      );
    }
    throw new Error("Error re-fetching README", error);
  }
}

export async function rerunContributingValidation(
  context,
  owner,
  repository,
  issueBody
) {
  logwatch.start("Refetching CONTRIBUTING file...");
  try {
    const contributing = await checkForContributingFile(
      context,
      owner,
      repository.name
    );
    const existingContributingEntry =
      await db.contributingValidation.findUnique({
        where: {
          repository_id: repository.id,
        },
      });
    if (existingContributingEntry) {
      // Update the entry
      await db.contributingValidation.update({
        data: {
          contributing_path: contributing.path,
          contributing_content: contributing.content,
          contains_contributing: contributing.status,
        },
        where: {
          repository_id: repository.id,
        },
      });
    } else {
      // Create a new entry
      await db.contributingValidation.create({
        data: {
          contributing_path: contributing.path,
          contributing_content: contributing.content,
          contains_contributing: contributing.status,
          repository: {
            connect: {
              id: repository.id,
            },
          },
        },
      });
    }
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
          message: "Error.cause message for fetching CONTRIBUTING file",
          error_cause: error.cause,
          error: error,
        },
        true
      );
    }
    throw new Error("Error re-fetching CONTRIBUTING", error);
  }
}

export async function rerunCodeOfConductValidation(
  context,
  owner,
  repository,
  issueBody
) {
  logwatch.start("Refetching Code of Conduct file...");
  try {
    const codeOfConduct = await checkForCodeofConduct(
      context,
      owner,
      repository.name
    );
    const existingCodeOfConductEntry =
      await db.codeofConductValidation.findUnique({
        where: {
          repository_id: repository.id,
        },
      });

    if (existingCodeOfConductEntry) {
      await db.codeofConductValidation.update({
        data: {
          code_path: codeOfConduct.path,
          code_content: codeOfConduct.content,
          contains_code: codeOfConduct.status,
        },
        where: {
          repository_id: repository.id,
        },
      });
    } else {
      await db.codeofConductValidation.create({
        data: {
          code_path: codeOfConduct.path,
          code_content: codeOfConduct.content,
          contains_code: codeOfConduct.status,
          repository: {
            connect: {
              id: repository.id,
            },
          },
        },
      });
    }
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
          message: "Error.cause message for fetching Code of Conduct file",
          error_cause: error.cause,
          error: error,
        },
        true
      );
    }
    throw new Error("Error re-fetching Code of Conduct", error);
  }
}

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

    let existingMetadataEntry = await db.codeMetadata.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (existingMetadataEntry?.metadata) {
      // Update the metadata variable
      containsCitation = existingMetadataEntry.contains_citation;
      containsCodemeta = existingMetadataEntry.contains_codemeta;
      metadata = applyDbMetadata(existingMetadataEntry, metadata);
    } else {
      // create blank entry to prevent issues down the line
      existingMetadataEntry = await db.codeMetadata.create({
        data: {
          identifier: createId(),
          repository: {
            connect: {
              id: repository.id,
            },
          },
        },
      });
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

export async function rerunCWLValidation(
  context,
  owner,
  repository,
  issueBody
) {
  try {
    logwatch.start("Rerunning CWL Validation...");
    // fetch installation and its relations
    const installation = await db.installation.findFirst({
      include: {
        CodeMetadata: true,
        LicenseRequest: true,
        ReadmeValidation: true,
      },
      where: { owner, repo: repository.name },
    });

    if (!installation) {
      throw new Error("Installation not found in the database");
    }

    const citation = installation.CodeMetadata?.contains_citation;
    const codemeta = installation.CodeMetadata?.contains_codemeta;
    const license = installation.LicenseRequest?.contains_license;
    const readme = {
      status: installation?.ReadmeValidation?.contains_readme || false,
      path: installation?.ReadmeValidation?.readme_path || null,
      content: installation?.ReadmeValidation?.readme_content || "",
    };

    const cwlObject = await getCWLFiles(context, owner, repository);

    const subjects = {
      cwl: cwlObject,
      citation,
      codemeta,
      license,
      readme,
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

export async function rerunFullRepoValidation(
  context,
  owner,
  repository,
  issueBody
) {
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
