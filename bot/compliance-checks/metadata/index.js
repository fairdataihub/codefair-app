import yaml from "js-yaml";
import {
  gatherLanguagesUsed,
  gatherRepoAuthors,
  getDOI,
  createId,
} from "../../utils/tools/index.js";
import dbInstance from "../../db.js";
import { logwatch } from "../../utils/logwatch.js";

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
const { VALIDATOR_URL, GH_APP_NAME } = process.env;

export async function checkMetadataFilesExists(context, owner, repository) {
  // Promise.all to fetch both files in parallel
  const [codemetaInfo, citationInfo] = await Promise.all([
    await context.octokit.repos
      .getContent({
        owner,
        repo: repository.name,
        path: "codemeta.json",
      })
      .catch((error) => {
        if (error.status === 404) {
          return null;
        }
        throw new Error("Error getting codemeta.json file", error);
      }),
    await context.octokit.repos
      .getContent({
        owner,
        repo: repository.name,
        path: "CITATION.cff",
      })
      .catch((error) => {
        if (error.status === 404) {
          return null;
        }
        throw new Error("Error getting CITATION.cff file", error);
      }),
  ]);
  const citationExists = citationInfo !== null;
  const codemetaExists = codemetaInfo !== null;
  logwatch.info(
    `Metadata files check for ${owner}/${repository.name}: codemeta.json exists: ${codemetaExists}, CITATION.cff exists: ${citationExists}`
  );
  return {
    citation: citationExists,
    codemeta: codemetaExists,
  };
}

/**
 * Helper object to create structured validation results
 * Makes error handling cleaner and preserves context
 */
const ValidationResult = {
  valid: (message, details = null) => ({
    isValid: true,
    status: "valid",
    message,
    details,
  }),
  invalid: (message, details = null) => ({
    isValid: false,
    status: "invalid",
    message,
    details,
  }),
  unknown: (message, details = null) => ({
    isValid: false,
    status: "unknown",
    message,
    details,
  }),
  error: (error) => ({
    isValid: false,
    status: "unknown",
    message: `Validation error: ${error.message}`,
    details: {
      error: error.message,
      stack: error.stack,
    },
  }),
};

/**
 * * Gets the metadata for the repository and returns it as a string
 * @param {Object} context - The GitHub context object
 * @param {String} owner - The owner of the repository
 * @param {Object} repository - Object containing the repository information
 * @returns - The content of the codemeta.json file as a string object
 */
export async function getCodemetaContent(context, owner, repository) {
  try {
    const codemetaFile = await context.octokit.repos.getContent({
      owner,
      path: "codemeta.json",
      repo: repository.name,
    });

    const raw = Buffer.from(codemetaFile.data.content, "base64").toString();

    return {
      content: raw,
      sha: codemetaFile.data.sha,
      file_path: codemetaFile.data.download_url,
    };
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    throw new Error("Error getting codemeta.json file", error);
  }
}

/**
 * * Get the content of the CITATION.cff file
 * @param {Object} context - The GitHub context object
 * @param {String} owner - The owner of the repository
 * @param {Object} repository - The repository information
 * @returns {String} - The content of the CITATION.cff file as a string object (need to yaml load it)
 */
export async function getCitationContent(context, owner, repository) {
  try {
    const citationFile = await context.octokit.repos.getContent({
      owner,
      path: "CITATION.cff",
      repo: repository.name,
    });

    const raw = Buffer.from(citationFile.data.content, "base64").toString();

    return {
      content: raw,
      sha: citationFile.data.sha,
      file_path: citationFile.data.download_url,
    };
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    throw new Error("Error getting CITATION.cff file", error);
  }
}

/**
 * Validate codemeta.json
 * Returns ValidationResult instead of throwing or updating DB directly
 */
async function validateCodemeta(metadataInfo) {
  if (!metadataInfo || metadataInfo.content == null) {
    return ValidationResult.invalid(
      "codemeta.json content is null or undefined"
    );
  }

  let { content } = metadataInfo;

  let obj;
  try {
    if (typeof content === "string") {
      const text = normalizeText(content);
      obj = JSON.parse(text); // ← Parse the string to object and assign to obj
    } else if (typeof content === "object" && !Array.isArray(content)) {
      obj = content; // Already parsed
    } else {
      return ValidationResult.invalid(
        `Unexpected content type: ${typeof content}${Array.isArray(content) ? " (array)" : ""}`
      );
    }
  } catch (err) {
    return ValidationResult.invalid(
      `Invalid JSON in codemeta.json: ${err.message}`
    );
  }

  const missing = ["name", "author", "description"].filter((f) => !obj[f]);
  if (missing.length) {
    return ValidationResult.invalid(
      `Required fields missing: ${missing.join(", ")}`
    );
  }

  try {
    const resp = await fetch(`${VALIDATOR_URL}/validate-codemeta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_content: obj }),
    });
    const result = await resp.json();

    if (!resp.ok) {
      return ValidationResult.unknown(
        `Validator service returned error (${resp.status})`,
        { statusCode: resp.status, response: result }
      );
    }

    if (result.message === "valid") {
      return ValidationResult.valid(
        `Codemeta is valid according to schema v${result.version}`,
        { version: result.version }
      );
    } else {
      return ValidationResult.invalid(result.error || "Validation failed", {
        version: result.version,
      });
    }
  } catch (error) {
    return ValidationResult.error(error);
  }
}

/**
 * Validate CITATION.cff
 */
async function validateCitation(metadataInfo) {
  if (!metadataInfo || metadataInfo.content == null) {
    return ValidationResult.invalid(
      "CITATION.cff content is null or undefined"
    );
  }

  let { content, file_path } = metadataInfo;

  let doc;
  try {
    if (typeof content !== "string") {
      content = JSON.stringify(content);
    }
    const text = normalizeText(content);
    doc = yaml.load(text);
  } catch (err) {
    return ValidationResult.invalid(
      `Invalid YAML in CITATION.cff: ${err.message}`
    );
  }

  if (!doc.title || !Array.isArray(doc.authors) || doc.authors.length === 0) {
    return ValidationResult.invalid(
      "Required fields (title, authors) missing or empty"
    );
  }

  try {
    const resp = await fetch(`${VALIDATOR_URL}/validate-citation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_path }),
    });

    const result = await resp.json();

    if (!resp.ok) {
      return ValidationResult.unknown(
        `Validator service returned error (${resp.status})`,
        { statusCode: resp.status, response: result }
      );
    }

    if (result.message === "valid") {
      return ValidationResult.valid(result.output || "Valid CITATION.cff");
    } else {
      return ValidationResult.invalid(result.error || "Validation failed");
    }
  } catch (err) {
    return ValidationResult.error(err);
  }
}

/**
 * * Ensures the metadata is valid based on certain fields
 * @param {String} content - The content of the metadata file
 * @param {String} fileType - The type of metadata file (codemeta or citation)
 * @param {String} file_path - Raw GitHub file path
 * @returns {Boolean} - True if the metadata is valid, false otherwise
 */
export async function validateMetadata(metadataInfo, fileType) {
  switch (fileType) {
    case "codemeta":
      return await validateCodemeta(metadataInfo);
    case "citation":
      return await validateCitation(metadataInfo);
    default:
      return ValidationResult.invalid(`Unsupported file type: ${fileType}`);
  }
}

function determineRevalidationNeeds(context, subjects) {
  const actor = context.payload?.pusher?.name;

  // If no actor or it's our bot, revalidate everything that exists
  logwatch.info(`Push actor: ${actor}`);
  if (!actor || actor === `${GH_APP_NAME}[bot]`) {
    logwatch.info(
      `Revalidating all metadata files due to bot push or no actor`
    );
    return {
      revalidate: true,
      codemeta: subjects.codemeta,
      citation: subjects.citation,
    };
  }

  // Check ALL commits in the push for changes
  const commits = context.payload.commits || [];

  let licenseChanged = false;
  let codemetaChanged = false;
  let citationChanged = false;

  commits.forEach((commit) => {
    const allFiles = [
      ...(commit.added || []),
      ...(commit.modified || []),
      ...(commit.removed || []),
    ];

    if (allFiles.includes("LICENSE")) {
      licenseChanged = true;
    }
    if (allFiles.includes("codemeta.json")) {
      codemetaChanged = true;
    }
    if (allFiles.includes("CITATION.cff")) {
      citationChanged = true;
    }
  });

  if (licenseChanged) {
    return {
      revalidate: true,
      codemeta: subjects.codemeta,
      citation: subjects.citation,
    };
  }

  return {
    revalidate: codemetaChanged || citationChanged,
    codemeta: codemetaChanged && subjects.codemeta,
    citation: citationChanged && subjects.citation,
  };
}

/**
 * Ensure a metadata record exists in the database
 * Creates skeleton record if it doesn't exist
 * Returns the existing or newly created record
 */
async function ensureMetadataRecord(repoId, subjects) {
  try {
    let existing = await dbInstance.codeMetadata.findUnique({
      where: { repository_id: repoId },
    });

    if (!existing) {
      //Create skeleton record
      existing = await dbInstance.codeMetadata.create({
        data: {
          identifier: createId(),
          repository: { connect: { id: repoId } },
          contains_citation: subjects.citation || false,
          contains_codemeta: subjects.codemeta || false,
          contains_metadata: !!(subjects.citation & subjects.codemeta),
          codemeta_status: "",
          citation_status: "",
          codemeta_validation_message: "",
          citation_validation_message: "",
          metadata: {},
        },
      });

      logwatch.info(
        {
          message: `Created new metadata record for repository ID ${repoId}`,
          identifier: existing.identifier,
        },
        true
      );
    }

    return existing;
  } catch (error) {
    logwatch.error(
      {
        message: "Database error in ensureMetadataRecord",
        repoId,
        error: error.message,
        stack: error.stack,
      },
      true
    );
    throw new Error("Failed to ensure metadata record exists", {
      cause: error,
    });
  }
}

/**
 * Update metadata record in database with validation results
 */
async function updateMetadataRecord(
  repoId,
  metadata,
  codemetaValidation,
  citationValidation,
  subjects
) {
  try {
    const dataObject = {
      contains_citation: subjects.citation,
      contains_codemeta: subjects.codemeta,
      contains_metadata: !!(subjects.citation & subjects.codemeta),
      metadata,
      codemeta_status: codemetaValidation.status,
      codemeta_validation_message: codemetaValidation.message,
      citation_status: citationValidation.status,
      citation_validation_message: citationValidation.message,
    };

    await dbInstance.codeMetadata.update({
      where: { repository_id: repoId },
      data: dataObject,
    });

    logwatch.info(
      {
        message: `Metadata record updated for repository ID ${repoId}`,
        repoId,
        codemetaStatus: codemetaValidation.status,
        citationStatus: citationValidation.status,
      },
      true
    );
  } catch (error) {
    logwatch.error(
      {
        message: "database error in updateMetadataRecord",
        repoId,
        error: error.message,
        stack: error.stack,
      },
      true
    );
    throw new Error("Failed to update metadata record", { cause: error });
  }
}

/**
 * Main function to update metadata in database
 * Handles validation, merging, and database operations
 * @param {number} repoId - The repository ID in the database
 * @param {Object} subjects - The subjects object indicating which metadata files exist
 * @param {Object} repository - The GitHub repository information
 * @param {string} owner - The owner of the repository
 * @param {Object} context - The GitHub context object
 * @returns {Object} - The updated metadata record
 */
export async function updateMetadataDatabase(
  repoId,
  subjects,
  repository,
  owner,
  context
) {
  const repoInfo = `${owner}/${repository.name}`;

  // 1. Ensure database record exists (creates sekeleton if not)
  let existing;
  try {
    existing = await ensureMetadataRecord(repository.id, subjects);
  } catch (err) {
    logwatch.error(
      {
        message: "Failed to ensure metadata record exisxts",
        repo: repoInfo,
        repoId: repository.id,
        error: err.message,
        stack: err.stack,
      },
      true
    );
    throw err;
  }

  // 2) Determine which files to revalidate
  const revalidationNeeds = determineRevalidationNeeds(context, subjects);

  logwatch.info(
    {
      message: "Determined revalidation needs",
      repo: repoInfo,
      revalidate: revalidationNeeds.revalidate,
      codemeta: revalidationNeeds.codemeta,
      citation: revalidationNeeds.citation,
    },
    true
  );

  // 3) Initialize metadata and validations results from existing record
  let metadata = existing?.metadata || {};
  let codemetaValidation = {
    isValid: existing.codemeta_status === "valid",
    status: existing.codemeta_status || "",
    message: existing.codemeta_validation_message || "Not yet validated",
  };
  let citationValidation = {
    isValid: existing.citation_status === "valid",
    status: existing.citation_status || "",
    message: existing.citation_validation_message || "Not yet validated",
  };

  // 4) Gather and validate metadata if needed
  if (revalidationNeeds.revalidate) {
    try {
      // Gather base metadata from GitHub API
      metadata = await gatherMetadata(context, owner, repository);
      logwatch.info(
        {
          message: `Gathered metadata from GitHub API for ${repoInfo}`,
          metadata,
        },
        true
      );

      // Merge with existing DB metadata (preserving user edits)
      if (existing?.metadata && Object.keys(existing.metadata).length > 0) {
        metadata = applyDbMetadata(existing, metadata);
        logwatch.info(
          `Merged existing DB metadata for ${owner}/${repository.name}`
        );
      }
    } catch (err) {
      logwatch.warn(
        {
          message: "Failed to gather base emtadata, using existing",
          repo: repoInfo,
          error: err.message,
        },
        true
      );
      // Continue with existing metadata
    }

    // Process codemeta.json if it exists and needs revalidation
    if (subjects.codemeta && revalidationNeeds.codemeta) {
      try {
        const codemetaContent = await getCodemetaContent(
          context,
          owner,
          repository
        );

        if (codemetaContent) {
          logwatch.info(
            `Fetched codemeta.json content for repo: ${repository.name} (ID: ${repoId})`
          );

          // Validate codemeta.json
          codemetaValidation = await validateMetadata(
            codemetaContent,
            "codemeta"
          );

          // Log based on validation status
          if (codemetaValidation.isValid) {
            logwatch.success(
              `Codemeta.json is valid for repo: ${repository.name} (ID: ${repoId})`
            );
          } else if (codemetaValidation.status === "unknown") {
            logwatch.warn(
              {
                message: `Codemeta.json validation service error`,
                repo: `${repository.name} (ID: ${repoId})`,
                validationMessage: codemetaValidation.message,
                details: codemetaValidation.details,
              },
              true
            );
          } else {
            logwatch.info(
              {
                message: "Codemeta.json validation failed (user issue)",
                repo: `${repository.name} (ID: ${repoId})`,
                validationMessage: codemetaValidation.message,
                details: codemetaValidation.details,
              },
              true
            );
          }

          // Apply metadata regardless of validation status
          try {
            metadata = await applyCodemetaMetadata(
              codemetaContent,
              metadata,
              repository
            );
            logwatch.info(
              `Applied codemeta.json metadata for repo: ${repository.name} (ID: ${repoId})`
            );
          } catch (error) {
            logwatch.warn(
              {
                message:
                  "Failed to apply codemeta.json metadata, using existing",
                repo: `${repository.name} (ID: ${repoId})`,
                error: error.message,
              },
              true
            );
          }
        } else {
          codemetaValidation = ValidationResult.invalid("File not found");
          logwatch.info(
            `No codemeta.json found for repo: ${repository.name} (ID: ${repoId})`
          );
        }
      } catch (error) {
        //  Fetch or other error
        logwatch.warn(
          {
            message: "Error fetching codemeta.json",
            repo: `${repository.name} (ID: ${repoId})`,
            error: error.message,
            stack: error.stack,
          },
          true
        );
      }
    }

    logwatch.info(`subjects.citation: ${subjects.citation}`);
    logwatch.info(`revalidationNeeds.citation: ${revalidationNeeds.citation}`);
    // Process CITATION.cff if it exists and needs revalidation
    if (subjects.citation && revalidationNeeds.citation) {
      try {
        const citationContent = await getCitationContent(
          context,
          owner,
          repository
        );

        if (citationContent) {
          logwatch.info(
            `Fetched CITATION.cff content for repo: ${repository.name} (ID: ${repoId})`
          );

          // Validate
          citationValidation = await validateMetadata(
            citationContent,
            "citation"
          );

          // Log based on validation status
          if (citationValidation.isValid) {
            logwatch.success(
              `CITATION.cff is valid for repo: ${repository.name} (ID: ${repoId})`
            );
          } else if (citationValidation.status === "unknown") {
            logwatch.warn(
              {
                message: `CITATION.cff validation service error`,
                repo: `${repository.name} (ID: ${repoId})`,
                validationMessage: citationValidation.message,
                details: citationValidation.details,
              },
              true
            );
          } else {
            logwatch.info(
              {
                message: "CITATION.cff validation failed (user issue)",
                repo: `${repository.name} (ID: ${repoId})`,
                validationMessage: citationValidation.message,
                details: citationValidation.details,
              },
              true
            );
          }

          try {
            metadata = await applyCitationMetadata(
              citationContent,
              metadata,
              repository
            );
            logwatch.info(
              `Applied CITATION.cff metadata for repo: ${repository.name} (ID: ${repoId})`
            );
          } catch (error) {
            logwatch.warn(
              {
                message: "Failed to apply CITATION.cff metadata, skipping",
                repo: `${repository.name} (ID: ${repoId})`,
                error: error.message,
              },
              true
            );
          }
        } else {
          citationValidation = ValidationResult.invalid("File not found");
          logwatch.info(
            `No CITATION.cff found for repo: ${repository.name} (ID: ${repoId})`
          );
        }
      } catch (error) {
        // Fetch or other error
        logwatch.warn(
          {
            message: "Error fetching CITATION.cff",
            repo: `${repository.name} (ID: ${repoId})`,
            error: error.message,
            stack: error.stack,
          },
          true
        );
        citationValidation = ValidationResult.error(error);
      }
    }

    // 5) Update db
    try {
      await updateMetadataRecord(
        repoId,
        metadata,
        codemetaValidation,
        citationValidation,
        subjects
      );
    } catch (error) {
      logwatch.error(
        {
          message: "Failed to update metadata record in database",
          repo: repoInfo,
          repoId,
          error: error.message,
          stack: error.stack,
        },
        true
      );
      throw error;
    }
  }

  // 6) return results
  return {
    metadata,
    validCodemeta: codemetaValidation.isValid,
    validCitation: citationValidation.isValid,
    codemetaValidation,
    citationValidation,
    existing,
  };
}

/**
 * * Converts the date to a Unix timestamp
 *
 * @param {string} date - The date to convert to Unix timestamp
 *
 * @returns {number} - The Unix timestamp of the date
 */
export function convertDateToUnix(date) {
  // Convert to a Date object
  const newDate = new Date(date);

  // Convert to Unix timestamp (in milliseconds)
  return Math.floor(newDate.getTime());
}

/**
 * * Get status emoji and text for validation display
 * @param {*} validation
 * @returns
 */
function getValidationDisplay(validation) {
  if (validation.status === "valid") {
    return { emoji: "✅", text: "Valid" };
  } else if (validation.status === "unknown") {
    return { emoji: "⚠️", text: "Unknown (Service error, try again)" };
  } else {
    return { emoji: "❌", text: "Invalid" };
  }
}

/**
 * Strip BOM, then trim
 */
function normalizeText(raw) {
  return raw.replace(/^\uFEFF/, "").trim();
}

/**
 * * Converts the codemeta.json file content to a metadata object for the database
 * @param {JSON} codemetaContent - The codemeta.json file content
 * @returns {JSON} - The metadata object for the database
 */
export async function convertCodemetaForDB(codemetaContent, repository) {
  try {
    // eslint-disable-next-line prefer-const
    const sortedAuthors = [];
    // eslint-disable-next-line prefer-const
    const sortedContributors = [];
    if (codemetaContent?.author) {
      codemetaContent?.author.forEach((author) => {
        // If the author is a Person or Organization, we need to add them
        if (author.type === "Person" || author.type === "Organization") {
          sortedAuthors.push({
            affiliation: author?.affiliation?.name || "",
            email: author?.email || "",
            familyName: author?.familyName || "",
            givenName: author?.givenName || "",
            roles: [], // Roles will be added later
            uri: author?.id || "",
          });
        }
      });

      // Loop through the authors again to handle roles
      codemetaContent?.author.forEach((author) => {
        if (author.type === "Role") {
          // Find the author that matches the "schema:author" field of the role
          sortedAuthors.forEach((sortedAuthor) => {
            if (sortedAuthor.uri === author?.["schema:author"]) {
              // Create the role object
              const roleObj = {
                role: author.roleName || "",
                startDate: author.startDate
                  ? convertDateToUnix(author.startDate)
                  : null,
                endDate: author.endDate
                  ? convertDateToUnix(author.endDate)
                  : null,
              };
              // Add the role to the author's roles array
              sortedAuthor.roles.push(roleObj);
            }
          });
        }
      });
    }

    if (codemetaContent?.contributor) {
      // Loop through all contributors
      codemetaContent?.contributor.forEach((contributor) => {
        // If the contributor is a Person or Organization, we need to add them
        if (
          contributor.type === "Person" ||
          contributor.type === "Organization"
        ) {
          sortedContributors.push({
            affiliation: contributor?.affiliation?.name || "",
            email: contributor?.email || "",
            familyName: contributor?.familyName || "",
            givenName: contributor?.givenName || "",
            roles: [], // Roles will be added later
            uri: contributor?.id || "",
          });
        }
      });

      // Loop through the contributors again to handle roles
      codemetaContent?.contributor.forEach((contributor) => {
        if (contributor.type === "Role") {
          // Find the contributor that matches the "contributor" field of the role
          sortedContributors.forEach((sortedContributor) => {
            if (
              sortedContributor.uri === contributor?.contributor ||
              sortedContributor.uri === contributor["schema:contributor"]
            ) {
              // Create the role object
              const roleObj = {
                role: contributor.roleName || "",
                startDate: contributor.startDate
                  ? convertDateToUnix(contributor.startDate)
                  : null,
                endDate: contributor.endDate
                  ? convertDateToUnix(contributor.endDate)
                  : null,
              };
              // Add the role to the contributor's roles array
              sortedContributor.roles.push(roleObj);
            }
          });
        }
      });
    }

    for (let i = 0; i < sortedAuthors.length; i++) {
      if (sortedAuthors[i].uri.startsWith("_:")) {
        delete sortedAuthors[i].uri;
      }
    }

    for (let i = 0; i < sortedContributors.length; i++) {
      if (sortedContributors[i].uri.startsWith("_:")) {
        delete sortedContributors[i].uri;
      }
    }

    const regex = /https:\/\/spdx\.org\/licenses\/(.*)/;
    let licenseId = null;
    let url;
    if (codemetaContent?.license) {
      url = codemetaContent.license;
      const match = url.match(regex);

      if (match) {
        licenseId = match[1];
      }
    }

    if (licenseId === null) {
      // Fetch license details from database
      const license = await dbInstance.licenseRequest.findUnique({
        where: {
          repository_id: repository.id,
        },
      });

      if (license?.license_id) {
        licenseId = `https://spdx.org/licenses/${license.license_id}`;
      }
    }

    return {
      name: codemetaContent?.name || null,
      applicationCategory: codemetaContent?.applicationCategory || null,
      authors: sortedAuthors,
      codeRepository: codemetaContent?.codeRepository || "",
      continuousIntegration:
        codemetaContent?.["codemeta:continuousIntegration"]?.id || "",
      contributors: sortedContributors,
      creationDate: codemetaContent?.dateCreated
        ? convertDateToUnix(codemetaContent?.dateCreated)
        : null,
      currentVersion: codemetaContent?.version || "",
      currentVersionDownloadURL: codemetaContent?.downloadUrl || "",
      currentVersionReleaseDate: codemetaContent?.dateModified
        ? convertDateToUnix(codemetaContent?.dateModified)
        : null,
      currentVersionReleaseNotes:
        codemetaContent?.["schema:releaseNotes"] || "",
      description: codemetaContent?.description || "",
      developmentStatus: codemetaContent?.developmentStatus || null,
      firstReleaseDate: codemetaContent?.datePublished
        ? convertDateToUnix(codemetaContent?.datePublished)
        : null,
      fundingCode: codemetaContent?.funding || "",
      fundingOrganization: codemetaContent?.funder?.name || "",
      isPartOf: codemetaContent?.isPartOf || "",
      isSourceCodeOf: codemetaContent?.["codemeta:isSourceCodeOf"]?.id || "",
      issueTracker: codemetaContent?.issueTracker || "",
      keywords: codemetaContent?.keywords || [],
      license: licenseId,
      operatingSystem: codemetaContent?.operatingSystem || [],
      otherSoftwareRequirements: codemetaContent?.softwareRequirements || [],
      programmingLanguages: codemetaContent?.programmingLanguage || [],
      referencePublication: codemetaContent?.referencePublication || "",
      relatedLinks: codemetaContent?.relatedLink || [],
      reviewAspect: codemetaContent?.reviewAspect || "",
      reviewBody: codemetaContent?.reviewBody || "",
      runtimePlatform: codemetaContent?.runtimePlatform || [],
      uniqueIdentifier: codemetaContent?.identifier || "",
    };
  } catch (error) {
    throw new Error("Error converting codemeta.json file to metadata object", {
      cause: error,
    });
  }
}

/**
 * * Converts the CITATION.cff file content to a metadata object for the database
 * @param {YAML} citationContent - The CITATION.cff file content loaded as a YAML object
 * @param {Object} repository - The repository information
 * @returns {Object} - The metadata object for the database
 */
export async function convertCitationForDB(citationContent, repository) {
  try {
    const authors = [];

    if (citationContent?.authors) {
      citationContent.authors.forEach((author) => {
        authors.push({
          affiliation: author.affiliation || "",
          email: author.email || "",
          familyName: author["family-names"] || "",
          givenName: author["given-names"] || "",
        });
      });
    }

    return {
      authors,
      uniqueIdentifier: citationContent?.doi || null,
      license: citationContent?.license || null,
      codeRepository: citationContent["repository-code"] || null,
      description: citationContent.abstract || null,
      currentVersionReleaseDate: citationContent["date-released"] || null,
      currentVersion: citationContent.version || null,
      keywords: citationContent.keywords || null,
    };
  } catch (error) {
    throw new Error("Error converting CITATION.cff file to metadata object", {
      cause: error,
    });
  }
}

/**
 * * Gathers metadata to create a citation.cff and codemeta.json file
 *
 * @param {string} context - Event context
 * @param {string} owner - The owner of the repository
 * @param {object} repo - The repository object
 *
 * @returns {object} - An object containing the metadata for the repository
 */
export async function gatherMetadata(context, owner, repo) {
  let repoData;
  try {
    repoData = await context.octokit.repos.get({
      owner,
      repo: repo.name,
    });
  } catch (err) {
    logwatch.error(
      {
        message: "Failed to fetch repository data",
        owner,
        repo: repo.name,
        err,
      },
      true
    );
    throw new Error(
      `Error fetching repo data for ${owner}/${repo.name}: ${err.message}`
    );
  }

  let releases;
  try {
    releases = await context.octokit.repos.listReleases({
      owner,
      repo: repo.name,
    });
  } catch (err) {
    logwatch.error(
      { message: "Failed to fetch releases", owner, repo: repo.name, err },
      true
    );
    throw new Error(
      `Error fetching releases for ${owner}/${repo.name}: ${err.message}`
    );
  }

  let doi;
  try {
    doi = await getDOI(context, owner, repo.name);
  } catch (err) {
    logwatch.error(
      { message: "Failed to fetch DOI", owner, repo: repo.name, err },
      true
    );
    throw new Error(
      `Error fetching DOI for ${owner}/${repo.name}: ${err.message}`
    );
  }

  let languagesUsed;
  try {
    languagesUsed = await gatherLanguagesUsed(context, owner, repo.name);
  } catch (err) {
    logwatch.error(
      { message: "Failed to gather languages", owner, repo: repo.name, err },
      true
    );
    throw new Error(
      `Error gathering languages for ${owner}/${repo.name}: ${err.message}`
    );
  }

  let citationAuthors;
  try {
    citationAuthors = await gatherRepoAuthors(
      context,
      owner,
      repo.name,
      "citation"
    );
  } catch (err) {
    logwatch.error(
      { message: "Failed to gather authors", owner, repo: repo.name, err },
      true
    );
    throw new Error(
      `Error gathering authors for ${owner}/${repo.name}: ${err.message}`
    );
  }

  // Build the codeMeta object, pulling defaults safely
  const releasesData = releases.data[0] || {};
  const createdAt = Date.parse(repoData.data.created_at) || null;
  const publishedAt = Date.parse(releasesData.published_at) || null;

  const codeMeta = {
    name: repoData.data.name,
    applicationCategory: null,
    authors: citationAuthors || [],
    codeRepository: repoData.data.html_url,
    continuousIntegration: "",
    contributors: [],
    creationDate: createdAt,
    currentVersion: releasesData.tag_name || "",
    currentVersionDownloadURL: releasesData.html_url || "",
    currentVersionReleaseDate: publishedAt,
    currentVersionReleaseNotes: releasesData.body || "",
    description: repoData.data.description || "",
    developmentStatus: null,
    firstReleaseDate: publishedAt,
    fundingCode: "",
    fundingOrganization: "",
    isPartOf: "",
    isSourceCodeOf: "",
    issueTracker: `https://github.com/${owner}/${repo.name}/issues`,
    keywords: repoData.data.topics || [],
    license:
      repoData.data.license?.spdx_id === "NOASSERTION"
        ? null
        : repoData.data.license?.spdx_id || null,
    operatingSystem: [],
    otherSoftwareRequirements: [],
    programmingLanguages: languagesUsed || [],
    referencePublication: doi[1] || "",
    relatedLinks: [],
    reviewAspect: "",
    reviewBody: "",
    runtimePlatform: [],
    uniqueIdentifier: "",
  };

  logwatch.info(`Successfully gathered metadata for ${owner}/${repo.name}`);
  return codeMeta;
}

/**
 * * Updates the metadata files with the Zenodo identifier
 * @param {Object} context - The GitHub context object
 * @param {String} owner - The owner of the repository
 * @param {Object} repository - The repository information
 * @param {String} identifier - The Zenodo identifier
 * @param {String} version - The version of the software
 * @returns {Object} - The updated codemeta.json file
 */
export async function updateMetadataIdentifier(
  context,
  owner,
  repository,
  identifier,
  version
) {
  try {
    // Get the citation file
    const citationObj = await getCitationContent(context, owner, repository);
    const codeMetaObj = await getCodemetaContent(context, owner, repository);

    let codeMetaFile = JSON.parse(codeMetaObj.content);
    const codeMetaSha = codeMetaObj.sha || null;

    let citationFile = yaml.load(citationObj.content);
    const citationSha = citationObj.sha || null;
    const updated_date = new Date().toISOString().split("T")[0];

    const zenodoMetadata = await dbInstance.zenodoDeposition.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (!zenodoMetadata) {
      throw new Error(
        "Zenodo metadata not found in the database. Please create a new Zenodo deposition."
      );
    }

    // console.log("Zenodo metadata", zenodoMetadata);
    const DOI_REGEX = /10\.\d{4,9}(?:\.\d+)?\/[-A-Za-z0-9:/_.;()[\]\\]+/;

    // Normalize the provided identifier and ensure we produce a doi.org URL
    let doiValue = "";
    const identifierString = String(identifier ?? "").trim();

    if (identifierString) {
      // Case 1: it's a DOI resolver URL like https://doi.org/10.5281/zenodo.1003150
      const doiUrlMatch = identifierString.match(
        /^https?:\/\/(?:dx\.)?doi\.org\/(.+)/i
      );

      if (doiUrlMatch && doiUrlMatch[1]) {
        const extracted = doiUrlMatch[1].trim();
        const extractedMatch = extracted.match(DOI_REGEX);
        doiValue = extractedMatch ? extractedMatch[0] : extracted;
      } else {
        // Case 2: it's maybe a bare DOI or some identifier string
        const directDoiMatch = identifierString.match(DOI_REGEX);
        doiValue = directDoiMatch ? directDoiMatch[0] : identifierString;
      }
    }
    citationFile.doi = doiValue;
    citationFile["date-released"] = updated_date;
    citationFile.version = zenodoMetadata?.zenodo_metadata?.version;
    codeMetaFile.identifier = identifier;
    codeMetaFile.version = zenodoMetadata.zenodo_metadata?.version;
    codeMetaFile.dateModified = updated_date;

    const response = await dbInstance.licenseRequest.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (!response) {
      throw new Error("Error fetching license details from database", response);
    }

    codeMetaFile.license = `https://spdx.org/licenses/${response.license_id}`;
    citationFile.license = response.license_id;

    // Update the citation file
    await context.octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repository.name,
      path: "CITATION.cff",
      message: "chore: 📝 Update CITATION.cff with Zenodo identifier",
      content: Buffer.from(
        yaml.dump(citationFile, { noRefs: true, indent: 2 })
      ).toString("base64"),
      sha: citationSha,
    });

    logwatch.success("CITATION.cff file updated with Zenodo identifier");

    // Update the codemeta file
    await context.octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repository.name,
      path: "codemeta.json",
      message: "chore: 📝 Update codemeta.json with Zenodo identifier",
      content: Buffer.from(JSON.stringify(codeMetaFile, null, 2)).toString(
        "base64"
      ),
      sha: codeMetaSha,
    });

    logwatch.success("codemeta.json file updated with Zenodo identifier");

    // Get the codemetadata content from the database
    const existingCodemeta = await dbInstance.codeMetadata.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (!existingCodemeta) {
      throw new Error("Error fetching codemeta.json from the database");
    }

    // Update the codemetadata content with the new Zenodo identifier
    existingCodemeta.metadata.uniqueIdentifier = identifier;
    existingCodemeta.metadata.currentVersion =
      zenodoMetadata.zenodo_metadata?.version || version;

    // Update the database with the latest metadata
    await dbInstance.codeMetadata.update({
      where: {
        repository_id: repository.id,
      },
      data: {
        metadata: existingCodemeta.metadata,
      },
    });

    return codeMetaFile;
  } catch (error) {
    throw new Error(`Error on updating the GitHub metadata files: ${error}`, {
      cause: error,
    });
  }
}

export function applyDbMetadata(existingMetadataEntry, metadata) {
  const existingMetadata = existingMetadataEntry.metadata;

  metadata.name = existingMetadata.name || metadata.name || "";
  metadata.authors = existingMetadata.authors || metadata.authors || [];
  metadata.contributors =
    existingMetadata.contributors || metadata.contributors || [];
  metadata.applicationCategory =
    existingMetadata.applicationCategory ||
    metadata.applicationCategory ||
    null;
  metadata.codeRepository =
    existingMetadata.codeRepository || metadata.codeRepository || "";
  metadata.continuousIntegration =
    existingMetadata.continuousIntegration ||
    metadata.continuousIntegration ||
    "";
  metadata.creationDate =
    existingMetadata.creationDate || metadata.creationDate || null;
  metadata.currentVersion =
    existingMetadata.currentVersion || metadata.currentVersion || "";
  metadata.currentVersionDownloadURL =
    existingMetadata.currentVersionDownloadURL ||
    metadata.currentVersionDownloadURL ||
    "";
  metadata.currentVersionReleaseDate =
    existingMetadata.currentVersionReleaseDate ||
    metadata.currentVersionReleaseDate ||
    null;
  metadata.currentVersionReleaseNotes =
    existingMetadata.currentVersionReleaseNotes ||
    metadata.currentVersionReleaseNotes ||
    "";
  metadata.description =
    existingMetadata.description || metadata.description || "";
  metadata.developmentStatus =
    existingMetadata.developmentStatus || metadata.developmentStatus || null;
  metadata.firstReleaseDate =
    existingMetadata.firstReleaseDate || metadata.firstReleaseDate || null;
  metadata.fundingCode =
    existingMetadata.fundingCode || metadata.fundingCode || "";
  metadata.fundingOrganization =
    existingMetadata.fundingOrganization || metadata.fundingOrganization || "";
  metadata.isPartOf = existingMetadata.isPartOf || metadata.isPartOf || "";
  metadata.isSourceCodeOf =
    existingMetadata.isSourceCodeOf || metadata.isSourceCodeOf || "";
  metadata.issueTracker =
    existingMetadata.issueTracker || metadata.issueTracker || "";
  metadata.keywords = existingMetadata.keywords || metadata.keywords || [];
  metadata.license = existingMetadata.license || metadata.license || null;
  metadata.operatingSystem =
    existingMetadata.operatingSystem || metadata.operatingSystem || [];
  metadata.otherSoftwareRequirements =
    existingMetadata.otherSoftwareRequirements ||
    metadata.otherSoftwareRequirements ||
    [];
  metadata.programmingLanguages =
    existingMetadata.programmingLanguages ||
    metadata.programmingLanguages ||
    [];
  metadata.referencePublication =
    existingMetadata.referencePublication ||
    metadata.referencePublication ||
    "";
  metadata.relatedLinks =
    existingMetadata.relatedLinks || metadata.relatedLinks || [];
  metadata.reviewAspect =
    existingMetadata.reviewAspect || metadata.reviewAspect || "";
  metadata.reviewBody =
    existingMetadata.reviewBody || metadata.reviewBody || "";
  metadata.runtimePlatform =
    existingMetadata.runtimePlatform || metadata.runtimePlatform || [];
  metadata.uniqueIdentifier =
    existingMetadata.uniqueIdentifier || metadata.uniqueIdentifier || "";

  // Ensure authors and contributors have a role key
  metadata.authors = metadata.authors.map((author) => {
    if (!author.roles) {
      author.roles = [];
    }
    return author;
  });

  return metadata;
}

export async function applyCodemetaMetadata(codemeta, metadata, repository) {
  logwatch.info("Codemeta found");
  try {
    // consola.warn("codemeta", codemeta.content.trim());
    let codemetaContent;
    try {
      codemetaContent = JSON.parse(codemeta.content.trim());
    } catch (error) {
      logwatch.error(
        { message: "Error parsing codemeta content", error },
        true
      );
      return;
    }
    const convertedCodemeta = await convertCodemetaForDB(
      codemetaContent,
      repository
    );

    metadata.name = convertedCodemeta.name || metadata.name || "";
    metadata.applicationCategory =
      convertedCodemeta.applicationCategory ||
      metadata.applicationCategory ||
      null;
    metadata.codeRepository =
      convertedCodemeta.codeRepository || metadata.codeRepository || "";
    metadata.continuousIntegration =
      convertedCodemeta.continuousIntegration ||
      metadata.continuousIntegration ||
      "";
    metadata.creationDate =
      convertedCodemeta.creationDate || metadata.creationDate || null;
    metadata.currentVersion =
      convertedCodemeta.version || metadata.currentVersion || "";
    metadata.currentVersionDownloadURL =
      convertedCodemeta.currentVersionDownloadURL ||
      metadata.currentVersionDownloadURL ||
      "";
    metadata.currentVersionReleaseDate =
      convertedCodemeta.currentVersionReleaseDate ||
      metadata.currentVersionReleaseDate ||
      null;
    metadata.currentVersionReleaseNotes =
      convertedCodemeta.currentVersionReleaseNotes ||
      metadata.currentVersionReleaseNotes ||
      "";
    metadata.description =
      convertedCodemeta.description || metadata.description || "";
    metadata.developmentStatus =
      convertedCodemeta.developmentStatus || metadata.developmentStatus || null;
    metadata.firstReleaseDate =
      convertedCodemeta.firstReleaseDate || metadata.firstReleaseDate || null;
    metadata.fundingCode =
      convertedCodemeta.fundingCode || metadata.fundingCode || "";
    metadata.fundingOrganization =
      convertedCodemeta.fundingOrganization ||
      metadata.fundingOrganization ||
      "";
    metadata.isPartOf = convertedCodemeta.isPartOf || metadata.isPartOf || "";
    metadata.reviewAspect =
      convertedCodemeta.reviewAspect || metadata.reviewAspect || "";
    metadata.reviewBody =
      convertedCodemeta.reviewBody || metadata.reviewBody || "";
    metadata.runtimePlatform =
      convertedCodemeta.runtimePlatform || metadata.runtimePlatform || [];
    metadata.uniqueIdentifier =
      convertedCodemeta.uniqueIdentifier || metadata.uniqueIdentifier || "";
    metadata.isSourceCodeOf =
      convertedCodemeta.isSourceCodeOf || metadata.isSourceCodeOf || "";
    metadata.programmingLanguages =
      convertedCodemeta.programmingLanguages ||
      metadata.programmingLanguages ||
      [];
    metadata.operatingSystem =
      convertedCodemeta.operatingSystem || metadata.operatingSystem || [];
    metadata.relatedLinks =
      convertedCodemeta.relatedLinks || metadata.relatedLinks || [];
    metadata.otherSoftwareRequirements =
      convertedCodemeta.otherSoftwareRequirements ||
      metadata.otherSoftwareRequirements ||
      [];

    if (metadata.authors) {
      if (convertedCodemeta.authors.length > 0) {
        const updatedAuthors = convertedCodemeta.authors.map((author) => {
          // Find a matching author in metadata
          const foundAuthor = metadata.authors.find(
            (existingAuthor) =>
              existingAuthor?.familyName === author?.familyName &&
              existingAuthor?.givenName === author?.givenName
          );

          if (foundAuthor) {
            // Merge roles, avoiding duplicates based on `role` and `startDate`
            if (!foundAuthor?.roles) {
              foundAuthor.roles = [];
            }
            const mergedRoles = [
              ...foundAuthor.roles,
              ...author.roles.filter(
                (newRole) =>
                  !foundAuthor.roles.some(
                    (existingRole) =>
                      existingRole.role === newRole.role &&
                      existingRole.startDate === newRole.startDate
                  )
              ),
            ];

            // Merge and prioritize data from `author`
            return {
              ...foundAuthor,
              ...author,
              affiliation: author.affiliation || foundAuthor.affiliation || "",
              email: author.email || foundAuthor.email || "",
              uri: author.uri || foundAuthor.uri || "",
              roles: mergedRoles,
            };
          }

          // If no match, return the current author from convertedCodemeta
          return author;
        });

        // Merge updated authors with any authors in metadata not present in convertedCodemeta
        const nonUpdatedAuthors = metadata.authors.filter(
          (existingAuthor) =>
            !convertedCodemeta.authors.some(
              (author) =>
                author.familyName === existingAuthor.familyName &&
                author.givenName === existingAuthor.givenName
            )
        );

        metadata.authors = [...nonUpdatedAuthors, ...updatedAuthors];
      }
    }

    if (metadata.contributors) {
      if (convertedCodemeta.contributors.length > 0) {
        const updatedContributors = convertedCodemeta.contributors.map(
          (contributor) => {
            // Find a matching contributor in metadata
            const foundContributor = metadata.contributors.find(
              (existingContributor) =>
                existingContributor?.familyName === contributor?.familyName &&
                existingContributor?.givenName === contributor?.givenName
            );

            if (foundContributor) {
              if (!foundContributor?.roles) {
                foundContributor.roles = [];
              }
              // Merge roles, avoiding duplicates based on `role` and `startDate`
              const mergedRoles = [
                ...foundContributor.roles,
                ...contributor.roles.filter(
                  (newRole) =>
                    !foundContributor.roles.some(
                      (existingRole) =>
                        existingRole.role === newRole.role &&
                        existingRole.startDate === newRole.startDate
                    )
                ),
              ];

              // Merge and prioritize data from `contributor`
              return {
                ...foundContributor,
                ...contributor,
                affiliation:
                  contributor.affiliation || foundContributor.affiliation || "",
                email: contributor.email || foundContributor.email || "",
                uri: contributor.uri || foundContributor.uri || "",
                roles: mergedRoles,
              };
            }

            // If no match, return the current contributor from convertedCodemeta
            return contributor;
          }
        );

        // Merge updated contributors with any contributors in metadata not present in convertedCodemeta
        const nonUpdatedContributors = metadata.contributors.filter(
          (existingContributor) =>
            !convertedCodemeta.contributors.some(
              (contributor) =>
                contributor.familyName === existingContributor.familyName &&
                contributor.givenName === existingContributor.givenName
            )
        );

        metadata.contributors = [
          ...nonUpdatedContributors,
          ...updatedContributors,
        ];
      }
    } else if (convertedCodemeta.contributors.length > 0) {
      // If metadata.contributors is empty, directly assign convertedCodemeta.contributors
      metadata.contributors = [...convertedCodemeta.contributors];
    }

    return metadata;
  } catch (error) {
    logwatch.error(
      { message: "Error applying codemeta metadata", error },
      true
    );
    throw new Error("Error applying codemeta metadata", { cause: error });
  }
}

export async function applyCitationMetadata(citation, metadata, repository) {
  logwatch.info("Citation found");
  const citationContent = yaml.load(citation.content);
  const convertedCitation = await convertCitationForDB(
    citationContent,
    repository
  );

  metadata.license = convertedCitation.license || metadata.license || null;
  metadata.codeRepository =
    convertedCitation.codeRepository || metadata.codeRepository || "";
  metadata.currentVersion =
    convertedCitation.currentVersion || metadata.currentVersion || "";
  metadata.currentVersionReleaseDate =
    convertedCitation.currentVersionReleaseDate ||
    metadata.currentVersionReleaseDate ||
    null;
  metadata.keywords = convertedCitation.keywords || metadata.keywords || [];
  metadata.uniqueIdentifier =
    convertedCitation.uniqueIdentifier || metadata.uniqueIdentifier || "";
  metadata.description =
    convertedCitation.description || metadata.description || "";

  if (convertedCitation.authors) {
    // Check if the authors are already in the metadata, if so update the details of the author
    if (metadata.authors.length > 0) {
      const updatedAuthors = convertedCitation.authors.map((author) => {
        // Find an existing author in metadata.authors with the same familyName and givenName
        const foundAuthor = metadata.authors.find(
          (existingAuthor) =>
            existingAuthor.familyName === author.familyName &&
            existingAuthor.givenName === author.givenName
        );

        if (foundAuthor) {
          // Update author details, preserving information from convertedCitation
          return {
            ...foundAuthor, // Existing details from metadata.authors
            ...author, // Overwrite with any additional information from convertedCitation
            affiliation: author.affiliation || foundAuthor.affiliation || "",
            email: author.email || foundAuthor.email || "",
          };
        }

        // If no matching author is found, return the current author from convertedCitation
        return author;
      });

      // Update metadata.authors with the consolidated list
      metadata.authors = updatedAuthors;
    } else {
      // If metadata.authors is empty, simply assign convertedCitation.authors
      metadata.authors = [...convertedCitation.authors];
    }
  }

  return metadata;
}

// TODO: Prevent the user from creating/updating metadata if custom license file exists and has no license title
/**
 * * Applies the metadata template to the base template (CITATION.cff and codemeta.json)
 *
 * @param {object} subjects - The subjects to check for
 * @param {string} baseTemplate - The base template to add to
 * @param {object} repository - The GitHub repository information
 * @param {string} owner - The owner of the repository
 * @param {object} context - The GitHub context object
 *
 * @returns {string} - The updated base template
 */
export async function applyMetadataTemplate(
  subjects,
  baseTemplate,
  repository,
  owner,
  context
) {
  const repoName = repository.name;
  const repoId = repository.id;

  try {
    // Fetch metadata (handles all validations and db updates)
    const result = await updateMetadataDatabase(
      repoId,
      subjects,
      repository,
      owner,
      context
    );

    // Urls
    const url = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repoName}/edit/code-metadata`;
    const validationsUrl = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repoName}/view/metadata-validation`;

    // Render appropriate template based on state
    if (!subjects.license.status) {
      // No license - metadata check not run
      const metadataBadge = `![Metadata](https://img.shields.io/badge/Metadata_Not_Checked-fbbf24)`;
      baseTemplate += `## Metadata\n\nTo make your software FAIR a \`CITATION.cff\` and \`codemeta.json\` metadata files are expected at the root level of your repository.\n> [!WARNING]\n> Codefair will run this check after a LICENSE file is detected in your repository.\n\n${metadataBadge}\n\n`;
    } else if (!subjects.codemeta || !subjects.citation) {
      // License exists but no codemeta.json and/or CITATION.cff
      const metadataBadge = `[![Metadata](https://img.shields.io/badge/Add_Metadata-dc2626.svg)](${url})`;
      baseTemplate += `## Metadata ❌\n\nTo make your software FAIR, a \`CITATION.cff\` and \`codemeta.json\` are expected at the root level of your repository. These files are not found in the repository. If you would like Codefair to add these files, click the "Add metadata" button below to go to our interface for providing metadata and generating these files.\n\n${metadataBadge}\n\n`;
    } else {
      // Both metadata files exist
      const allValid = result.validCodemeta && result.validCitation;
      const hasUnknown =
        result.codemetaValidation.status === "unknown" ||
        result.citationValidation.status === "unknown";

      const editBadge = `[![Metadata](https://img.shields.io/badge/Edit_Metadata-0ea5e9.svg)](${url})`;
      const validationsBadge = `[![View Validations](https://img.shields.io/badge/View_Validations-f59e0b.svg)](${validationsUrl})`;

      let headingIcon = "✔️";
      let bodyIntro = "";

      if (allValid) {
        headingIcon = "✔️";
        bodyIntro = `A \`CITATION.cff\` and \`codemeta.json\` file are found in the repository. They may need to be updated over time as new people are contributing to the software, etc.`;
      } else if (hasUnknown) {
        headingIcon = "⚠️";
        bodyIntro = `A \`CITATION.cff\` and \`codemeta.json\` file are found in the repository, but there was an **issue validating them** (our validation service may be down). Click **View Validations** for more details.`;
      } else {
        headingIcon = "⚠️";
        bodyIntro = `A \`CITATION.cff\` and \`codemeta.json\` file are found in the repository, but there are **validation issues**. Click **View Validations** to review and resolve them.`;
      }

      const citationDisplay = getValidationDisplay(result.citationValidation);
      const codemetaDisplay = getValidationDisplay(result.codemetaValidation);

      // Escape pipe characters and remove newlines in validation messages to prevent breaking the markdown table
      const sanitizeMessage = (msg) =>
        (msg || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      const citationMessage = sanitizeMessage(
        result.citationValidation.message
      );
      const codemetaMessage = sanitizeMessage(
        result.codemetaValidation.message
      );

      const resultsTable = `\n\n| File            | Status      | Message |\n|-----------------|-------------|----------|\n| \`CITATION.cff\`  | ${citationDisplay.emoji} ${citationDisplay.text} | ${citationMessage} |\n| \`codemeta.json\` | ${codemetaDisplay.emoji} ${codemetaDisplay.text} | ${codemetaMessage} |\n`;

      baseTemplate += `## Metadata ${headingIcon}\n\n${bodyIntro}${resultsTable}\n${editBadge} ${validationsBadge}\n\n`;
    }

    return baseTemplate;
  } catch (error) {
    logwatch.error(
      {
        message: "Error applying metadata template",
        error: JSON.stringify(error),
        repository: repoName,
        owner,
        error_stack: JSON.stringify(error.stack),
        error_message: JSON.stringify(error.message),
      },
      true
    );
    // Return template with error state
    baseTemplate += `## Metadata ⚠️\n\nAn error occurred while checking metadata files. Please try again later or contact support if the issue persists.\n\n`;
    return baseTemplate;
  }
}
