import { error } from "console";
import dbInstance from "../../db.js";
import { logwatch } from "../../utils/logwatch.js";
import fs from "fs";
import yaml from "js-yaml";
import { getCodemetaContent, getCitationContent } from "../metadata/index.js";

const licensesJson = JSON.parse(
  fs.readFileSync("./public/assets/data/licenses.json", "utf8")
);

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
const { ZENODO_ENDPOINT, ZENODO_API_ENDPOINT } = process.env;

// Identifier type constants
const IDENTIFIER_TYPE = {
  ZENODO_DOI: "zenodo_doi",
  OTHER_DOI: "other_doi",
  NON_DOI: "non_doi",
};

const ZENODO_DOI_PREFIX = "10.5281/zenodo.";
const DOI_REGEX = /10\.\d{4,9}(?:\.\d+)?\/[-A-Za-z0-9:/_.;()[\]\\]+/;

/**
 * Extract a DOI from various string formats
 * Handles: https://doi.org/..., dx.doi.org/..., bare DOI
 * @param {String} value - The string that may contain a DOI
 * @returns {String|null} - The extracted DOI or null
 */
function extractDOIFromString(value) {
  if (!value || typeof value !== "string") return null;

  const trimmed = value.trim();

  // Case 1: URL format (https://doi.org/... or dx.doi.org/...)
  const urlMatch = trimmed.match(/^https?:\/\/(?:dx\.)?doi\.org\/(.+)/i);
  if (urlMatch && urlMatch[1]) {
    const extracted = urlMatch[1].trim();
    const doiMatch = extracted.match(DOI_REGEX);
    return doiMatch ? doiMatch[0] : null;
  }

  // Case 2: Bare DOI
  const directMatch = trimmed.match(DOI_REGEX);
  return directMatch ? directMatch[0] : null;
}

/**
 * Classify an identifier as Zenodo DOI, Other DOI, or Non-DOI
 * @param {String} identifier - The identifier to classify
 * @returns {Object|null} - { type, value, displayValue, zenodoId? } or null
 */
function classifyIdentifier(identifier) {
  if (!identifier || typeof identifier !== "string") {
    return null;
  }

  const trimmed = identifier.trim();
  if (!trimmed) return null;

  // Try to extract DOI
  const doi = extractDOIFromString(trimmed);

  if (doi) {
    // Check if it's a Zenodo DOI (prefix 10.5281/zenodo.)
    if (doi.startsWith(ZENODO_DOI_PREFIX)) {
      const zenodoId = doi.replace(ZENODO_DOI_PREFIX, "");
      return {
        type: IDENTIFIER_TYPE.ZENODO_DOI,
        value: doi,
        displayValue: doi,
        zenodoId: zenodoId,
      };
    }
    return {
      type: IDENTIFIER_TYPE.OTHER_DOI,
      value: doi,
      displayValue: doi,
    };
  }

  // Non-DOI identifier
  return {
    type: IDENTIFIER_TYPE.NON_DOI,
    value: trimmed,
    displayValue: trimmed,
  };
}

/**
 * Extract identifiers from codemeta.json content
 * The identifier field can be a string, an array of strings, or an object with @id
 * @param {Object|String} codemetaContent - Parsed or raw codemeta.json content
 * @returns {Array} - Array of classified identifiers
 */
function extractIdentifiersFromCodemeta(codemetaContent) {
  const identifiers = [];

  if (!codemetaContent) return identifiers;

  let content = codemetaContent;
  if (typeof codemetaContent === "string") {
    try {
      content = JSON.parse(codemetaContent);
    } catch (e) {
      logwatch.warn(
        "Failed to parse codemeta.json content for identifier extraction"
      );
      return identifiers;
    }
  }

  const rawIdentifier = content?.identifier;

  if (!rawIdentifier) return identifiers;

  // Handle array of identifiers
  if (Array.isArray(rawIdentifier)) {
    for (const item of rawIdentifier) {
      const id =
        typeof item === "object" ? item["@id"] || item.id || item.value : item;
      const classified = classifyIdentifier(id);
      if (classified)
        identifiers.push({ ...classified, source: "codemeta.json" });
    }
  }
  // Handle object with @id
  else if (typeof rawIdentifier === "object") {
    const id = rawIdentifier["@id"] || rawIdentifier.id || rawIdentifier.value;
    const classified = classifyIdentifier(id);
    if (classified)
      identifiers.push({ ...classified, source: "codemeta.json" });
  }
  // Handle string
  else if (typeof rawIdentifier === "string") {
    const classified = classifyIdentifier(rawIdentifier);
    if (classified)
      identifiers.push({ ...classified, source: "codemeta.json" });
  }

  return identifiers;
}

/**
 * Extract DOI from CITATION.cff content
 * @param {Object|String} citationContent - Parsed YAML or raw CITATION.cff content
 * @returns {Array} - Array of classified identifiers
 */
function extractIdentifiersFromCitation(citationContent) {
  const identifiers = [];

  if (!citationContent) return identifiers;

  let content = citationContent;
  if (typeof citationContent === "string") {
    try {
      content = yaml.load(citationContent);
    } catch (e) {
      logwatch.warn(
        "Failed to parse CITATION.cff content for identifier extraction"
      );
      return identifiers;
    }
  }

  // CITATION.cff uses 'doi' field (not 'identifier')
  const rawDoi = content?.doi;

  if (rawDoi) {
    const classified = classifyIdentifier(rawDoi);
    if (classified) identifiers.push({ ...classified, source: "CITATION.cff" });
  }

  return identifiers;
}

/**
 * Fetch metadata files and extract all identifiers
 * @param {Object} context - GitHub context object
 * @param {String} owner - Repository owner
 * @param {Object} repository - Repository information
 * @returns {Object} - { identifiers: Array, errors: Array }
 */
async function fetchAndExtractIdentifiers(context, owner, repository) {
  const identifiers = [];
  const errors = [];

  // Fetch codemeta.json
  try {
    const codemetaResult = await getCodemetaContent(context, owner, repository);
    if (codemetaResult && codemetaResult.content) {
      const codemetaIds = extractIdentifiersFromCodemeta(
        codemetaResult.content
      );
      identifiers.push(...codemetaIds);
    }
  } catch (err) {
    if (err.status !== 404) {
      errors.push({ file: "codemeta.json", error: err.message });
      logwatch.warn(
        `Error fetching codemeta.json for identifier extraction: ${err.message}`
      );
    }
  }

  // Fetch CITATION.cff
  try {
    const citationResult = await getCitationContent(context, owner, repository);
    if (citationResult && citationResult.content) {
      const citationIds = extractIdentifiersFromCitation(
        citationResult.content
      );
      identifiers.push(...citationIds);
    }
  } catch (err) {
    if (err.status !== 404) {
      errors.push({ file: "CITATION.cff", error: err.message });
      logwatch.warn(
        `Error fetching CITATION.cff for identifier extraction: ${err.message}`
      );
    }
  }

  // Deduplicate identifiers by value
  const uniqueIdentifiers = [];
  const seen = new Set();
  for (const id of identifiers) {
    if (!seen.has(id.value)) {
      seen.add(id.value);
      uniqueIdentifiers.push(id);
    }
  }

  return { identifiers: uniqueIdentifiers, errors };
}

/**
 * Prioritize identifiers: Zenodo DOIs first, then other DOIs, then non-DOIs
 * @param {Array} identifiers - Array of classified identifiers
 * @returns {Object} - { primary: Identifier|null, others: Array }
 */
function prioritizeIdentifiers(identifiers) {
  if (!identifiers || identifiers.length === 0) {
    return { primary: null, others: [] };
  }

  // Sort: Zenodo DOIs first, then other DOIs, then non-DOIs
  const sorted = [...identifiers].sort((a, b) => {
    const priority = {
      [IDENTIFIER_TYPE.ZENODO_DOI]: 0,
      [IDENTIFIER_TYPE.OTHER_DOI]: 1,
      [IDENTIFIER_TYPE.NON_DOI]: 2,
    };
    return priority[a.type] - priority[b.type];
  });

  return {
    primary: sorted[0],
    others: sorted.slice(1),
  };
}

/**
 * Create a badge for a Zenodo DOI
 * @param {String} doi - The DOI value
 * @param {String} zenodoId - The Zenodo record ID
 * @returns {String} - Markdown badge
 */
function createZenodoDOIBadge(doi, zenodoId) {
  const escapedDoi = doi.replace(/-/g, "--");
  return `[![DOI](https://img.shields.io/badge/DOI-${escapedDoi}-blue)](${ZENODO_ENDPOINT}/records/${zenodoId})`;
}

/**
 * Create a badge for a non-Zenodo DOI
 * @param {String} doi - The DOI value
 * @returns {String} - Markdown badge
 */
function createOtherDOIBadge(doi) {
  const escapedDoi = doi.replace(/-/g, "--");
  return `[![DOI](https://img.shields.io/badge/DOI-${escapedDoi}-gray)](https://doi.org/${doi})`;
}

/**
 * Render template for a single identifier
 * @param {Object} identifier - The classified identifier
 * @param {String} releaseBadge - Badge for creating next release
 * @param {String} firstReleaseBadge - Badge for creating first release
 * @returns {String} - Template string
 */
function renderSingleIdentifierTemplate(
  identifier,
  releaseBadge,
  firstReleaseBadge
) {
  const archiveTitle = `\n\n## FAIR Software Release`;

  switch (identifier.type) {
    case IDENTIFIER_TYPE.ZENODO_DOI: {
      // One Zenodo DOI found - checkmark
      const zenodoBadge = createZenodoDOIBadge(
        identifier.value,
        identifier.zenodoId
      );
      return (
        `${archiveTitle} ✔️\n\n` +
        `A Zenodo DOI was found in your metadata files. This indicates your software may already be archived on Zenodo.\n\n` +
        `${zenodoBadge}\n\n` +
        `To automate your next archival with your GitHub Release, click the button below:\n\n` +
        `${releaseBadge}\n\n`
      );
    }

    case IDENTIFIER_TYPE.OTHER_DOI: {
      // One Other DOI found - info icon
      const otherBadge = createOtherDOIBadge(identifier.value);
      return (
        `${archiveTitle} ℹ️\n\n` +
        `A DOI was found in your metadata files. However, Codefair currently only supports automated archival through Zenodo.\n\n` +
        `${otherBadge}\n\n` +
        `> [!NOTE]\n` +
        `> Clicking the button below will create an additional Zenodo archive alongside your existing DOI.\n\n` +
        `${firstReleaseBadge}\n\n`
      );
    }

    case IDENTIFIER_TYPE.NON_DOI: {
      // One Non-DOI found - info icon
      return (
        `${archiveTitle} ℹ️\n\n` +
        `A non-DOI identifier was found in your metadata files. For FAIR compliance, we recommend obtaining a DOI through Zenodo.\n\n` +
        `Identifier: \`${identifier.value}\`\n\n` +
        `${firstReleaseBadge}\n\n`
      );
    }

    default:
      return "";
  }
}

/**
 * Render template for multiple identifiers
 * @param {Object} primary - The primary identifier
 * @param {Array} others - Other identifiers
 * @param {String} releaseBadge - Badge for creating next release
 * @param {String} firstReleaseBadge - Badge for creating first release
 * @returns {String} - Template string
 */
function renderMultipleIdentifiersTemplate(
  primary,
  others,
  releaseBadge,
  firstReleaseBadge
) {
  const archiveTitle = `\n\n## FAIR Software Release`;
  const hasZenodo = primary.type === IDENTIFIER_TYPE.ZENODO_DOI;

  let template = "";

  if (hasZenodo) {
    // Multiple with Zenodo - info icon, Zenodo is primary
    const zenodoBadge = createZenodoDOIBadge(primary.value, primary.zenodoId);
    template +=
      `${archiveTitle} ℹ️\n\n` +
      `This repository is already archived on Zenodo. To automate future GitHub releases to Zenodo, click the button below:\n\n` +
      `**Primary:** ${zenodoBadge}\n\n` +
      `${releaseBadge}\n\n`;
  } else {
    // Multiple without Zenodo - info icon
    let primaryBadge;
    if (primary.type === IDENTIFIER_TYPE.OTHER_DOI) {
      primaryBadge = createOtherDOIBadge(primary.value);
    } else {
      primaryBadge = `\`${primary.value}\``;
    }
    template +=
      `${archiveTitle} ℹ️\n\n` +
      `Multiple identifiers were found in your metadata files. No Zenodo DOI was detected. Currently Codefair supports automated archival through Zenodo.\n\n` +
      `**Primary:** ${primaryBadge}\n\n` +
      `> [!NOTE]\n` +
      `> Clicking the button below will create an additional Zenodo archive. We recommend consolidating to one archival platform when possible.\n\n` +
      `${firstReleaseBadge}\n\n`;
  }

  // Add expandable section for other identifiers
  if (others.length > 0) {
    template += `<details>\n<summary>Additional identifiers found (${others.length})</summary>\n\n`;
    for (const id of others) {
      if (id.type === IDENTIFIER_TYPE.ZENODO_DOI) {
        template += `- ${createZenodoDOIBadge(id.value, id.zenodoId)} (from ${id.source})\n`;
      } else if (id.type === IDENTIFIER_TYPE.OTHER_DOI) {
        template += `- ${createOtherDOIBadge(id.value)} (from ${id.source})\n`;
      } else {
        template += `- \`${id.value}\` (from ${id.source})\n`;
      }
    }
    template += `\n</details>\n\n`;
  }

  // Add info note for multiple identifiers with Zenodo
  if (hasZenodo && others.length > 0) {
    template += `> ℹ️ Multiple identifiers detected. Zenodo is shown as primary since it's supported for automation.\n\n`;
  }

  return template;
}

/**
 * * Update the GitHub release to not be a draft
 * @param {String} repositoryName - GitHub repository name
 * @param {String} owner - GitHub owner
 * @param {String} releaseId - GitHub release ID
 */
export async function updateGitHubRelease(
  context,
  repositoryName,
  owner,
  releaseId
) {
  try {
    await context.octokit.repos.updateRelease({
      owner,
      repo: repositoryName,
      release_id: releaseId,
      draft: false,
    });
    logwatch.success("Updated release to not be a draft!");
  } catch (error) {
    throw new Error(`Error updating the GitHub release: ${error}`, {
      cause: error,
    });
  }
}

/**
 * * Publishes a Zenodo deposition
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Access token for Zenodo API
 */
export async function publishZenodoDeposition(zenodoToken, depositionId) {
  try {
    logwatch.start(`Publishing the Zenodo deposition: ${depositionId}`);
    const url = `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}/actions/publish`;
    logwatch.info(`Sending POST request to: ${url}`);

    const publishDeposition = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${zenodoToken}`,
      },
    });

    logwatch.info(
      `Received response with status: ${publishDeposition.status} ${publishDeposition.statusText}`
    );

    if (!publishDeposition.ok) {
      let fetchResponse;
      try {
        fetchResponse = await publishDeposition.json();
      } catch (parseError) {
        logwatch.error("Failed to parse error response as JSON", parseError);
        fetchResponse = { error: "Unable to parse response as JSON" };
      }

      logwatch.error(
        { message: "Error publishing the Zenodo deposition:", fetchResponse },
        true
      );

      throw new Error(
        `Failed to publish the Zenodo deposition. Status: ${publishDeposition.status}: ${publishDeposition.statusText}, Error: ${JSON.stringify(fetchResponse)}`,
        { cause: fetchResponse }
      );
    }

    const publishedDeposition = await publishDeposition.json();
    logwatch.success(
      `Zenodo deposition published successfully at: ${publishedDeposition.links.latest_html}`
    );
  } catch (error) {
    logwatch.error({
      message: `Exception occurred during Zenodo publication: ${error.message}`,
      error: error,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * * Fetch the Zenodo API token from the db
 * @param {String} user - User who submitted the Zenodo publication request
 * @returns {String} Zenodo API token
 */
export async function getZenodoToken(user) {
  try {
    // Fetch the Zenodo token from the database
    const deposition = await dbInstance.zenodoToken.findFirst({
      where: {
        user: {
          username: user,
        },
      },
      select: {
        token: true,
      },
    });

    if (!deposition || !deposition.token) {
      throw new Error(`Deposition with tag ${tagVersion} not found in db.`, {
        cause: error,
      });
    }

    const zenodoTokenInfo = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions?access_token=${deposition.token}`,
      {
        method: "GET",
      }
    );

    if (!zenodoTokenInfo) {
      throw new Error(`Zenodo token not found`, { cause: error });
    }

    return deposition.token;
  } catch (error) {
    throw new Error(`Error fetching the Zenodo token: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * * Parse the Zenodo information from the GitHub issue body
 * @param {String} issueBody - GitHub issue body
 * @returns {Object} Object of Zenodo deposition information
 */
export function parseZenodoInfo(issueBody) {
  // Gather the information for the Zenodo deposition provided in the issue body
  const match = issueBody.match(
    /<!--\s*@codefair-bot\s*publish-zenodo\s*([\s\S]*?)-->/
  );
  if (!match) {
    throw new Error("Zenodo publish information not found in issue body.");
  }
  const [depositionId, releaseId, tagVersion, userWhoSubmitted] = match[1]
    .trim()
    .split(/\s+/);

  return { depositionId, releaseId, tagVersion, userWhoSubmitted };
}

/**
 * * Apply the archival template to the base template
 * @param {Object} context - GitHub context object
 * @param {String} baseTemplate - Base template for the issue
 * @param {Object} repository - GitHub repository information
 * @param {String} owner - GitHub owner
 * @param {Object} subjects - Subjects of the repository
 * @returns {String} String of updated base template with archival information
 */
export async function applyArchivalTemplate(
  context,
  baseTemplate,
  repository,
  owner,
  subjects
) {
  const archiveTitle = `\n\n## FAIR Software Release`;
  const badgeURL = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/release/zenodo`;
  const alreadyReleaseText = ` of your software was successfully released on GitHub and archived on Zenodo. You can view the Zenodo archive by clicking the button below:`;
  const firstReleaseBadgeButton = `[![Create Release on Zenodo](https://img.shields.io/badge/Create_Release_on_Zenodo-dc2626.svg)](${badgeURL})`;
  const releaseBadgeButton = `[![Create Release on Zenodo](https://img.shields.io/badge/Create_Release_on_Zenodo-00bcd4.svg)](${badgeURL})`;
  const noLicenseText = `\n\nTo make your software FAIR, a license file is required.\n> [!WARNING]\n> Codefair will run this check after a LICENSE file is detected in your repository.`;
  const noLicenseBadge = `![FAIR Release not checked](https://img.shields.io/badge/FAIR_Release_Not_Checked-fbbf24)`;

  // License must exist
  if (!subjects.license.status) {
    logwatch.info("License not found. Skipping FAIR release check.");
    baseTemplate += `${archiveTitle}\n\n${noLicenseText}\n\n${noLicenseBadge}\n\n`;
    return baseTemplate;
  }

  // STEP 1: Check for existing Codefair release in database
  let existingZenodoDep = await dbInstance.zenodoDeposition.findUnique({
    where: {
      repository_id: repository.id,
    },
  });

  // If we have a successful previous Codefair release with published DOI
  if (existingZenodoDep?.last_published_zenodo_doi) {
    logwatch.info(
      "Zenodo deposition with published DOI found in the database."
    );
    const response = await dbInstance.zenodoDeposition.update({
      data: {
        existing_zenodo_deposition_id: true,
        zenodo_id: existingZenodoDep.zenodo_id,
      },
      where: {
        repository_id: repository.id,
      },
    });

    const lastVersion = response.github_tag_name;
    const zenodoId = response.zenodo_id;
    const zenodoDoi = response.last_published_zenodo_doi;
    const zenodoDOIBadge = `[![DOI](https://img.shields.io/badge/DOI-${zenodoDoi}-blue)](${ZENODO_ENDPOINT}/records/${zenodoId})`;
    baseTemplate += `${archiveTitle} ✔️\n\n***${lastVersion}***${alreadyReleaseText}\n\n${zenodoDOIBadge}\n\nReady to create your next FAIR release? Click the button below:\n\n${releaseBadgeButton}\n\n`;
    return baseTemplate;
  }

  // STEP 2: No Codefair release - search metadata files for identifiers
  logwatch.info(
    "No previous Codefair release found. Searching metadata files for identifiers..."
  );

  const { identifiers, errors } = await fetchAndExtractIdentifiers(
    context,
    owner,
    repository
  );

  if (errors.length > 0) {
    logwatch.warn({ message: "Errors during identifier extraction", errors });
  }

  const { primary, others } = prioritizeIdentifiers(identifiers);

  // STEP 3: Display based on identifier count and type
  if (!primary) {
    // Zero identifiers - first time release
    const newReleaseText = `To make your software FAIR, it is necessary to archive it in an archival repository like Zenodo every time you make a release. When you are ready to make your first release, click the "Create release" button below to easily create a FAIR release where your metadata files are updated (including with a DOI) before creating a GitHub release and archiving it on Zenodo.`;
    baseTemplate += `${archiveTitle} ❌\n\n${newReleaseText}\n\n${firstReleaseBadgeButton}\n\n`;
  } else if (identifiers.length === 1) {
    // Single identifier
    baseTemplate += renderSingleIdentifierTemplate(
      primary,
      releaseBadgeButton,
      firstReleaseBadgeButton
    );
  } else {
    // Multiple identifiers
    baseTemplate += renderMultipleIdentifiersTemplate(
      primary,
      others,
      releaseBadgeButton,
      firstReleaseBadgeButton
    );
  }

  return baseTemplate;
}

/**
 * * Create a new Zenodo deposition (no metadata) and return the deposition information
 * @param {String} zenodoToken - Access token for Zenodo API
 * @returns - Object of new Zenodo deposition information
 */
export async function createNewZenodoDeposition(zenodoToken) {
  // Create new Zenodo deposition
  try {
    const zenodoRecord = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${zenodoToken}`,
        },
        body: JSON.stringify({}),
      }
    );

    return await zenodoRecord.json();
  } catch (error) {
    throw new Error(`Error creating a new Zenodo deposition: ${error}`, {
      cause: error,
    });
  }
}

/**
 * * Fetches an existing Zenodo deposition by the deposition ID
 * @param {String} zenodoToken - Access token for Zenodo API
 * @param {String} depositionId - Zenodo deposition ID
 * @returns - Object of Zenodo deposition information
 */
export async function fetchExistingZenodoDeposition(zenodoToken, depositionId) {
  try {
    // Will return 404 if the depositionId is a draft and in the "unsubmitted" state
    const zenodoDeposition = await fetch(
      `${ZENODO_API_ENDPOINT}/records/${depositionId}/versions/latest`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${zenodoToken}`,
        },
      }
    );

    if (zenodoDeposition.status === 404) {
      // Check if the deposition is a draft and return that
      const draftDeposition = await fetch(
        `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${zenodoToken}`,
          },
        }
      );

      if (!draftDeposition.ok) {
        const errorText = await draftDeposition.text();
        logwatch.error(
          {
            message: "Error fetching the Zenodo draft deposition:",
            fetchReponse: draftDeposition,
          },
          true
        );
        throw new Error(
          `Failed to fetch the Zenodo draft deposition. Status: ${draftDeposition.status}: ${draftDeposition.statusText}. Error: ${errorText}`
        );
      }

      return await draftDeposition.json();
    } else if (!zenodoDeposition.ok) {
      const errorText = await zenodoDeposition.text();
      logwatch.error(
        {
          message: "Error fetching the Zenodo deposition:",
          fetchReponse: zenodoDeposition,
        },
        true
      );
      throw new Error(
        `Failed to fetch the Zenodo deposition. Status: ${zenodoDeposition.status}: ${zenodoDeposition.statusText}. Error: ${errorText}`
      );
    }

    return await zenodoDeposition.json();
  } catch (error) {
    throw new Error(`Error fetching the Zenodo deposition: ${error}`, {
      cause: error,
    });
  }
}

/**
 * * Creates a new version of an existing Zenodo deposition
 * @param {String} zenodoToken - Access token for Zenodo API
 * @param {String} depositionId - Zenodo deposition ID
 * @returns - Object of the new Zenodo deposition version
 */
export async function createNewVersionOfDeposition(zenodoToken, depositionId) {
  try {
    const url = `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}/actions/newversion`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${zenodoToken}`,
      },
    });

    // Consume the response body once
    const responseBody = await response.json();

    if (!response.ok) {
      // Log detailed context
      logwatch.error(
        {
          message: "Error creating a new version of Zenodo deposition",
          endpoint: url,
          depositionId,
          status: response.status,
          responseBody,
        },
        true
      );
      // Use JSON.stringify to get a readable error message
      throw new Error(
        `Failed to create a new version of Zenodo deposition. HTTP Status: ${response.status}. Response: ${JSON.stringify(responseBody)}.`,
        { cause: responseBody }
      );
    }

    logwatch.success("New version of Zenodo deposition created successfully!");
    return responseBody;
  } catch (error) {
    logwatch.error(
      {
        message:
          "Unhandled error while creating a new version of Zenodo deposition",
        error: error.message,
        stack: error.stack,
      },
      true
    );
    throw new Error(
      `Error creating a new version of Zenodo deposition: ${error.message}`,
      { cause: error }
    );
  }
}

/**
 * Returns the latest draft deposition of a new or existing Zenodo deposition.
 * Files are deleted from the latest draft deposition.
 *
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Zenodo API token
 * @returns {Object} Object of Zenodo deposition info
 */
export async function getZenodoDepositionInfo(depositionId, zenodoToken) {
  try {
    if (depositionId === "new") {
      logwatch.info("Creating a new Zenodo deposition...");
      const newZenodoDeposition = await createNewZenodoDeposition(zenodoToken);
      logwatch.success("New Zenodo deposition created successfully!");
      return newZenodoDeposition;
    } else {
      // Fetch existing deposition info
      logwatch.info(`Fetching existing Zenodo deposition: ${depositionId}`);
      const zenodoDepositionInfo = await fetchExistingZenodoDeposition(
        zenodoToken,
        depositionId
      );

      if (!zenodoDepositionInfo) {
        throw new Error(
          `Failed to fetch deposition info for ID: ${depositionId}`
        );
      }

      // If the deposition is still a draft, delete its files.
      if (zenodoDepositionInfo.submitted === false) {
        logwatch.start("Deposition is a draft. Deleting files in the draft...");
        for (const file of zenodoDepositionInfo.files) {
          try {
            logwatch.info(
              `Deleting file "${file.filename}" from draft deposition...`
            );
            await deleteFileFromZenodo(
              depositionId,
              zenodoToken,
              file.filename
            );
            logwatch.success(`File "${file.filename}" deleted successfully.`);
          } catch (fileError) {
            logwatch.error(
              `Error deleting file "${file.filename}": ${fileError.message}`,
              fileError
            );
            throw new Error(
              `Error deleting file "${file.filename}": ${fileError.message}`,
              { cause: fileError }
            );
          }
        }
        logwatch.success("All files deleted from the draft deposition.");
        return zenodoDepositionInfo;
      }

      // If the deposition is submitted, create a new version.
      logwatch.info("Deposition is submitted. Creating a new version...");
      const newZenodoVersion = await createNewVersionOfDeposition(
        zenodoToken,
        zenodoDepositionInfo.id
      );

      if (!newZenodoVersion) {
        throw new Error(
          "Failed to create a new version of the Zenodo deposition."
        );
      }

      // Delete any files from the new version draft if present.
      if (newZenodoVersion.files && newZenodoVersion.files.length > 0) {
        for (const file of newZenodoVersion.files) {
          try {
            logwatch.start(
              `Deleting file from new draft: ${file.links.download}`
            );
            await deleteFileFromZenodo(
              newZenodoVersion.record_id,
              zenodoToken,
              file.filename
            );
            logwatch.success(
              `File "${file.filename}" deleted from new draft successfully.`
            );
          } catch (fileError) {
            logwatch.error(
              `Error deleting file "${file.filename}" from new draft: ${fileError.message}`,
              fileError
            );
            throw new Error(
              `Error deleting file "${file.filename}" from new draft: ${fileError.message}`,
              { cause: fileError }
            );
          }
        }
      }

      logwatch.success(
        "New draft version of Zenodo deposition created successfully!"
      );
      return newZenodoVersion;
    }
  } catch (error) {
    logwatch.error(`Error in getZenodoDepositionInfo: ${error.message}`, error);
    throw new Error(`Error in getZenodoDepositionInfo: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * * Creates metadata for Zenodo deposition - based on the codemeta.json file
 * @param {String} codemetadata - Code metadata JSON string (parse with JSON.parse)
 * @returns {Object} Object of Zenodo metadata
 */
export async function createZenodoMetadata(
  codemetadata,
  repository,
  addUploadType
) {
  try {
    const new_date = new Date().toISOString().split("T")[0];
    const codeMetaContent = codemetadata;
    const zenodoCreators = codeMetaContent.author
      .filter((author) => author?.type !== "Role")
      .map((author) => {
        const tempObj = {};

        // Format the name as "Family name, Given names"
        tempObj.name = author.familyName
          ? `${author.familyName}, ${author.givenName}`
          : author.givenName;

        // Add affiliation if present
        if (author.affiliation && author.affiliation.name) {
          tempObj.affiliation = author.affiliation.name;
        }

        // Add ORCID if present
        if (author.orcid) {
          tempObj.orcid = author.orcid;
        }

        return tempObj;
      });

    const existingLicense = await dbInstance.licenseRequest.findUnique({
      where: {
        repository_id: repository.id,
      },
    });
    if (!codeMetaContent.license) {
      // fetch from the db
      logwatch.warn(
        `No license found in the codemeta.json file. Fetching from the database...`
      );
      logwatch.info(
        `License found in the database: ${existingLicense?.license_id}`
      );
      codeMetaContent.license = `https://spdx.org/licenses/${existingLicense?.license_id}`;
    }
    const license = licensesJson.find(
      (license) => license.detailsUrl === `${codeMetaContent.license}.json`
    );
    const licenseId = license ? license.licenseId : null;

    if (!licenseId) {
      throw new Error(`License not found for URL: ${codeMetaContent.license}`, {
        cause: JSON.stringify(licenseId),
      });
    }

    const zenodoMetadata = await dbInstance.zenodoDeposition.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (!zenodoMetadata) {
      logwatch.error(
        "Zenodo metadata not found in the database. Please create a new Zenodo deposition."
      );
      throw new Error(
        "Zenodo metadata not found in the database. Please create a new Zenodo deposition."
      );
    }

    // console.log("fetched zenodo metadata: ", zenodoMetadata);

    if (licenseId === "Custom") {
      throw new Error("Custom licenses are not supported yet.");
      // return {
      //   metadata: {
      //     title: codeMetaContent?.name,
      //     description: codeMetaContent?.description,
      //     upload_type: "software",
      //     creators: zenodoCreators,
      //     access_right: zenodoMetadata.zenodo_metadata.accessRight,
      //     publication_date: new_date,
      //
      //     rights: [
      //       {
      //         description: {en: existingLicense?.license_content},
      //         title: {en: existingLicense?.custom_license_title}
      //       }
      //     ],
      //     version: zenodoMetadata.zenodo_metadata.version || codeMetaContent?.version,
      //     custom_license: zenodoMetadata.zenodo_metadata.custom_license,
      //   }
      // }
    }
    const metadata = {
      title: codeMetaContent?.name,
      description: codeMetaContent?.description,
      creators: zenodoCreators,
      access_right: zenodoMetadata.zenodo_metadata.accessRight,
      keywords: codeMetaContent?.keywords,
      publication_date: new_date,
      license: licenseId,
      version:
        zenodoMetadata.zenodo_metadata?.version || codeMetaContent?.version,
    };

    if (addUploadType) {
      metadata.upload_type = "software";
    }

    // const payload = {
    //   metadata,
    //   custom_fields: {
    //     "code:codeRepository": repository.html_url,
    //     "code:developmentStatus":
    //       codeMetaContent?.developmentStatus || "unknown",
    //     "code:programmingLanguage": codeMetaContent?.programmingLanguage || [],
    //   },
    // };

    // logwatch.info("Generated Zenodo metadata:");
    // logwatch.info(zenodoMetadata);

    return { metadata };
  } catch (error) {
    throw new Error(`Error getting Zenodo metadata: ${error}`, {
      cause: error,
    });
  }
}

/**
 * * Updates the Zenodo metadata for the deposition
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Access token for Zenodo API
 * @param {Object} metadata - Zenodo metadata object
 * @returns - Object of updated Zenodo metadata
 */
export async function updateZenodoMetadata(
  depositionId,
  zenodoToken,
  metadata
) {
  try {
    const url = `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}`;
    const logJson = {
      depositionId,
      url,
      metadata,
      message: `Updating Zenodo metadata for deposition: ${depositionId}`,
    };

    logwatch.start(logJson, true);

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${zenodoToken}`,
      },
      body: JSON.stringify(metadata),
    });

    // Log the status for debugging purposes
    logwatch.debug(
      `Received response with status: ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      let errorDetail;
      try {
        errorDetail = await response.json();
      } catch (jsonError) {
        errorDetail = await response.text();
      }
      logwatch.error(
        {
          message: "Error updating Zenodo metadata:",
          errorDetail,
        },
        true
      );
      throw new Error(
        `Failed to update Zenodo metadata. Status: ${response.status}: ${response.statusText}. Error: ${JSON.stringify(errorDetail)}`
      );
    }

    const updatedMetadataInfo = await response.json();
    logwatch.success("Zenodo deposition metadata updated successfully!");
    // console.log("Updated metadata:", updatedMetadataInfo);

    // If the metadata does not have an upload_type, add it and update the metadata again.
    if (!updatedMetadataInfo?.metadata?.upload_type) {
      logwatch.start("Adding upload_type to Zenodo metadata...");
      logwatch.info(
        `Adding upload_type to Zenodo metadata for deposition: ${depositionId}`
      );
      const newMetadata = {
        ...updatedMetadataInfo.metadata,
        upload_type: "software",
      };
      await updateZenodoMetadata(depositionId, zenodoToken, {
        metadata: newMetadata,
      });
      logwatch.success("Upload type added to Zenodo metadata!");
    }

    return updatedMetadataInfo;
  } catch (error) {
    logwatch.error(
      `Exception in updateZenodoMetadata: ${error.message}`,
      error
    );
    throw new Error(`Error updating Zenodo metadata: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * * Uploads the release assets to Zenodo deposition
 * @param {String} zenodoToken - Access token for Zenodo API
 * @param {Array} draftReleaseAssets - List of objects containing the release assets information
 * @param {*} repositoryArchive - The repository archive file
 * @param {String} owner - GitHub owner
 * @param {Object} context - GitHub context
 * @param {String} bucket_url - Zenodo bucket URL
 * @param {Object} repository - GitHub repository object
 * @param {String} tagVersion - Release tag/version
 */
export async function uploadReleaseAssetsToZenodo(
  zenodoToken,
  draftReleaseAssets,
  repositoryArchive,
  owner,
  context,
  bucket_url,
  repository,
  tagVersion
) {
  const startTime = performance.now();
  logwatch.info(
    `Starting upload process for repository "${repository.name}" with tag "${tagVersion}".`
  );

  if (draftReleaseAssets.length > 0) {
    for (const asset of draftReleaseAssets) {
      try {
        logwatch.info(`Processing asset "${asset.name}" (ID: ${asset.id}).`);

        // Download the raw file from GitHub
        const { data: assetData } = await context.octokit.repos.getReleaseAsset(
          {
            owner,
            repo: repository.name,
            asset_id: asset.id,
            headers: { accept: "application/octet-stream" },
          }
        );

        if (!assetData) {
          const errorMsg = `Asset data for "${asset.name}" is empty or undefined.`;
          logwatch.error(errorMsg);
          throw new Error(errorMsg);
        }
        logwatch.info(`Fetched data for asset "${asset.name}".`);

        // Convert the asset data to a buffer
        const assetBuffer = Buffer.from(assetData);

        // Upload the file to Zenodo
        const uploadUrl = `${bucket_url}/${asset.name}`;
        logwatch.info(`Uploading asset to Zenodo at: ${uploadUrl}`);
        const uploadAssetResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: assetBuffer, // Upload the raw file directly
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${zenodoToken}`,
            "Content-Type": "application/octet-stream",
          },
        });

        if (!uploadAssetResponse.ok) {
          // Attempt to capture error details
          let errorDetails = "";
          try {
            errorDetails = await uploadAssetResponse.text();
          } catch (e) {
            errorDetails = "Unable to retrieve error details";
          }
          const errorMsg = `Failed to upload asset "${asset.name}". Status: ${uploadAssetResponse.statusText}, Code: ${uploadAssetResponse.status}. Details: ${errorDetails}`;
          logwatch.error(errorMsg);
          throw new Error(errorMsg);
        }
        logwatch.success(
          `Asset "${asset.name}" uploaded successfully to Zenodo.`
        );
      } catch (assetError) {
        logwatch.error(
          `Error processing asset "${asset.name}": ${assetError.message}`
        );
        throw new Error(
          `Error uploading asset "${asset.name}": ${assetError.message}`,
          {
            cause: assetError,
          }
        );
      }
    }
  } else {
    logwatch.warn("No draft release assets provided for upload.");
  }

  // Upload the repository archive to Zenodo
  try {
    const archiveFilename = `${repository.name}-${tagVersion}.zip`;
    const archiveUploadUrl = `${bucket_url}/${archiveFilename}`;
    logwatch.info(
      `Uploading repository archive "${archiveFilename}" to Zenodo at: ${archiveUploadUrl}`
    );

    const uploadZipResponse = await fetch(archiveUploadUrl, {
      method: "PUT",
      body: repositoryArchive,
      headers: {
        Authorization: `Bearer ${zenodoToken}`,
      },
    });

    if (!uploadZipResponse.ok) {
      let errorDetails = "";
      try {
        errorDetails = await uploadZipResponse.text();
      } catch (e) {
        errorDetails = "Unable to retrieve error details";
      }
      const errorMsg = `Failed to upload repository archive. Status: ${uploadZipResponse.statusText}, Code: ${uploadZipResponse.status}. Details: ${errorDetails}`;
      logwatch.error(errorMsg);
      throw new Error(errorMsg);
    }
    logwatch.success("Repository archive uploaded successfully to Zenodo.");
  } catch (archiveError) {
    logwatch.error(
      `Error uploading repository archive: ${archiveError.message}`
    );
    throw new Error(
      `Error uploading repository archive: ${archiveError.message}`,
      {
        cause: archiveError,
      }
    );
  }

  const endTime = performance.now();
  const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
  logwatch.info(`Upload process completed in ${durationSeconds} seconds.`);
  logwatch.success("Zip file successfully uploaded to Zenodo!");
}

/**
 * * Deletes a file from a Zenodo deposition
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Access token for Zenodo API
 * @param {String} fileId - Zenodo file ID
 */
export async function deleteFileFromZenodo(
  depositionId,
  zenodoToken,
  fileName
) {
  try {
    const deleteFile = await fetch(
      `${ZENODO_API_ENDPOINT}/records/${depositionId}/draft/files/${fileName}?access_token=${zenodoToken}`,
      {
        method: "DELETE",
      }
    );

    if (!deleteFile.ok) {
      const errorText = await deleteFile.text();
      throw new Error(
        `Failed to delete file from Zenodo. Status: ${deleteFile.status}: ${deleteFile.statusText}. Error: ${errorText}`
      );
    }
  } catch (error) {
    throw new Error(`Error deleting file from Zenodo: ${error}`, {
      cause: error,
    });
  }
}
