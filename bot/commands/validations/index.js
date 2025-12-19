import { runComplianceChecks } from "../../compliance-checks/index.js";
import { renderIssues, createIssue } from "../../utils/renderer/index.js";
import dbInstance from "../../db.js";
import { logwatch } from "../../utils/logwatch.js";
import { applyLastModifiedTemplate } from "../../utils/tools/index.js";
import {
  checkForLicense,
  validateLicense,
} from "../../compliance-checks/license/index.js";
import { getCWLFiles } from "../../compliance-checks/cwl/index.js";
import {
  checkMetadataFilesExists,
  updateMetadataDatabase,
  applyMetadataTemplate,
} from "../../compliance-checks/metadata/index.js";
import { checkForReadme } from "../../compliance-checks/readme/index.js";
import {
  checkForContributingFile,
  checkForCodeofConduct,
} from "../../compliance-checks/additional-checks/index.js";

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
  const repoInfo = `${owner}/${repository.name}`;
  logwatch.start(
    `Rerunning metadata validation for repo: ${repository.name} (ID: ${repository.id})`
  );

  try {
    // Check which metadata files exist
    const subjects = await checkMetadataFilesExists(context, owner, repository);

    // Get license status (needed for metadata checks)
    const licenseCheck = await checkForLicense(context, owner, repository.name);
    subjects.license = licenseCheck?.status;

    // Force revalidation by creating a synthetic context that looks like bot push
    const syntheticContext = {
      ...context,
      payload: {
        ...context.payload,
        pusher: { name: `${process.env.GH_APP_NAME}[bot]` }, // Triggers full revalidation
      },
    };

    await updateMetadataDatabase(
      repository.id,
      subjects,
      repository,
      owner,
      syntheticContext
    );

    // Generate new metadata section
    let newMetadataSection = "";
    newMetadataSection = await applyMetadataTemplate(
      subjects,
      newMetadataSection,
      repository,
      owner,
      syntheticContext
    );

    // Parse the existing issue body to replace just the metadata section
    const issueBodyWithoutTimestamp = issueBody.substring(
      0,
      issueBody.indexOf(`<sub><span style="color: grey;">Last updated`)
    );

    // Find the metadata section boundaries
    const metadataStartMarker = "## Metadata";
    const metadataStartIndex =
      issueBodyWithoutTimestamp.indexOf(metadataStartMarker);

    if (metadataStartIndex === -1) {
      throw new Error("Could not find Metadata section in issue body");
    }

    // Find the next section (starts with ## or end of string)
    const afterMetadataStart = issueBodyWithoutTimestamp.substring(
      metadataStartIndex + metadataStartMarker.length
    );
    const nextSectionMatch = afterMetadataStart.match(/\n## /);

    let updatedBody;
    if (nextSectionMatch) {
      // There's another section after Metadata
      const nextSectionIndex =
        metadataStartIndex +
        metadataStartMarker.length +
        nextSectionMatch.index;

      updatedBody =
        issueBodyWithoutTimestamp.substring(0, metadataStartIndex) + // Before Metadata
        newMetadataSection + // New Metadata section
        issueBodyWithoutTimestamp.substring(nextSectionIndex); // After Metadata
    } else {
      // Metadata is the last section
      updatedBody =
        issueBodyWithoutTimestamp.substring(0, metadataStartIndex) + // Before Metadata
        newMetadataSection; // New Metadata section
    }

    // Add timestamp
    updatedBody = applyLastModifiedTemplate(updatedBody);

    // Update the issue
    await createIssue(context, owner, repository, ISSUE_TITLE, updatedBody);
    logwatch.info(
      `Metadata validation rerun completed for repo: ${repository.name} (ID: ${repository.id})`
    );
  } catch (error) {
    logwatch.error(
      {
        message: "Failed to rerun metadata validation",
        repo: repoInfo,
        error: error.message,
        stack: error.stack,
      },
      true
    );

    // rrestore issue body without command
    try {
      const issueBodyRemovedCommand = issueBody.substring(
        0,
        issueBody.indexOf(`<sub><span style="color: grey;">Last updated`)
      );
      const lastModified = applyLastModifiedTemplate(issueBodyRemovedCommand);

      await context.octokit.issues.update({
        owner,
        repo: repository.name,
        issue_number: context.payload.issue.number,
        body: lastModified,
      });
    } catch (restoreError) {
      logwatch.warn(
        {
          message: "Failed to restore issue body after error",
          repo: repoInfo,
          error: restoreError.message,
        },
        true
      );
    }

    throw error;
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
    const license = await checkForLicense(context, owner, repository.name);

    if (!license) {
      throw new Error("License not found in the repository");
    }

    // Update the database with the license information
    await updateLicenseDatabase(repository, license);

    // Update the issue body
    const issueBodyRemovedCommand = issueBody.substring(
      0,
      issueBody.indexOf(`<sub><span style="color: grey;">Last updated`)
    );

    // Generate new license section
    let newLicenseSection = "";
    newLicenseSection = await applyLicenseTemplate(
      license,
      newLicenseSection,
      repository,
      owner,
      context
    );
    // Parse the existing issue body to replace just the license section
    const issueBodyWithoutTimestamp = issueBodyRemovedCommand;
    const licenseStartMarker = "## LICENSE";
    const licenseStartIndex =
      issueBodyWithoutTimestamp.indexOf(licenseStartMarker);
    if (licenseStartIndex === -1) {
      throw new Error("Could not find LICENSE section in issue body");
    }

    // Find the next section (starts with ## or end of string)
    const afterLicenseStart = issueBodyWithoutTimestamp.substring(
      licenseStartIndex + licenseStartMarker.length
    );
    const nextSectionMatch = afterLicenseStart.match(/\n## /);
    let updatedBody;
    if (nextSectionMatch) {
      // There's another section after LICENSE
      const nextSectionIndex =
        licenseStartIndex + licenseStartMarker.length + nextSectionMatch.index;
      updatedBody =
        issueBodyWithoutTimestamp.substring(0, licenseStartIndex) + // Before LICENSE
        newLicenseSection + // New LICENSE section
        issueBodyWithoutTimestamp.substring(nextSectionIndex); // After LICENSE
    } else {
      // LICENSE is the last section
      updatedBody =
        issueBodyWithoutTimestamp.substring(0, licenseStartIndex) + // Before LICENSE
        newLicenseSection; // New LICENSE section
    }

    const lastModified = await applyLastModifiedTemplate(updatedBody);
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
          stack: error?.stack,
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
        ContributingValidation: true,
        CodeofConductValidation: true,
      },
      where: { owner, repo: repository.name },
    });

    if (!installation) {
      throw new Error("Installation not found in the database");
    }

    const citation = installation?.CodeMetadata?.contains_citation;
    const codemeta = installation?.CodeMetadata?.contains_codemeta;
    const license = installation?.LicenseRequest?.contains_license;
    const readme = {
      status: installation?.ReadmeValidation?.contains_readme || false,
      path: installation?.ReadmeValidation?.readme_path || "",
      content: installation?.ReadmeValidation?.readme_content || "",
    };

    const contributing = {
      status: installation?.contributingValidation?.contains_contrib || false,
      path: installation?.contributingValidation?.contrib_path || "",
      content: installation?.contributingValidation?.contrib_content || "",
    };

    const cofc = {
      status: installation?.codeofConductValidation?.contains_code || false,
      path: installation?.codeofConductValidation?.code_path || "",
      content: installation?.codeofConductValidation?.code_content || "",
    };

    const cwlObject = await getCWLFiles(context, owner, repository);

    const subjects = {
      cwl: cwlObject,
      citation,
      codemeta,
      license,
      readme,
      contributing,
      cofc,
    };

    const updatedBody = await renderIssues(
      context,
      owner,
      repository,
      false,
      subjects
    );

    await createIssue(context, owner, repository, ISSUE_TITLE, updatedBody);

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
    let subjects = await runComplianceChecks(context, owner, repository, true);

    const updateBody = await renderIssues(
      context,
      owner,
      repository,
      false,
      subjects
    );

    await createIssue(context, owner, repository, ISSUE_TITLE, updateBody);
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
