import { consola } from "consola";
import yaml from "js-yaml";
import {
  gatherLanguagesUsed,
  gatherRepoAuthors,
  getDOI,
  createId,
} from "../utils/tools/index.js";
import dbInstance from "../db.js";

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;

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
 * * Converts the codemeta.json file content to a metadata object for the database
 * @param {JSON} codemetaContent - The codemeta.json file content
 * @returns {JSON} - The metadata object for the database
 */
export async function convertCodemetaForDB(codemetaContent, repository) {
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
              startDate: author.startDate ? convertDateToUnix(author.startDate) : null,
              endDate: author.endDate ? convertDateToUnix(author.endDate) : null,
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
      if (contributor.type === "Person" || contributor.type === "Organization") {
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
          if (sortedContributor.uri === contributor?.contributor || sortedContributor.uri === contributor["schema:contributor"]) {
            // Create the role object
            const roleObj = {
              role: contributor.roleName || "",
              startDate: contributor.startDate ? convertDateToUnix(contributor.startDate) : null,
              endDate: contributor.endDate ? convertDateToUnix(contributor.endDate) : null,
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
  if (codemetaContent?.license) {
    const url = codemetaContent.license;
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
      licenseId = `https://spdx.org/licenses/${license.license_id}`
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
    currentVersionReleaseNotes: codemetaContent?.["schema:releaseNotes"] || "",
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
}

export async function convertCitationForDB(citationContent, repository) {
  const authors = [];

  if (citationContent?.authors) {
    citationContent.authors.forEach((author) => {
      authors.push({
        affiliation: author.affiliation || "",
        email: author.email || "",
        familyName: author["family-names"] || "",
        givenName: author["given-names"] || "",
      })
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
  consola.start("Gathering metadata...");

  // Get the metadata of the repo
  const repoData = await context.octokit.repos.get({
    owner,
    repo: repo.name,
  });

  // Get the release data of the repo
  const releases = await context.octokit.repos.listReleases({
    owner,
    repo: repo.name,
  });

  // Get authors, doi and languages used of repo
  const doi = await getDOI(context, owner, repo.name);
  const languagesUsed = await gatherLanguagesUsed(context, owner, repo.name);
  const citationAuthors = await gatherRepoAuthors(
    context,
    owner,
    repo.name,
    "citation",
  );
  let url;
  if (repoData.data.homepage != null) {
    url = repoData.data.homepage;
  }

  consola.success("Metadata gathered!");

  const codeMeta = {
    name: repoData.data.name,
    applicationCategory: null,
    authors: citationAuthors || [],
    codeRepository: repoData.data.html_url,
    continuousIntegration: "",
    contributors: [],
    creationDate: Date.parse(repoData.data.created_at) || null,
    currentVersion: releases.data[0]?.tag_name || "",
    currentVersionDownloadURL: releases.data[0]?.html_url || "",
    currentVersionReleaseDate:
      Date.parse(releases.data[0]?.published_at) || null,
    currentVersionReleaseNotes: releases.data[0]?.body || "",
    description: repoData.data.description,
    developmentStatus: null,
    firstReleaseDate: Date.parse(releases.data[0]?.published_at) || null,
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

  return codeMeta;
}

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

    return {
      content: Buffer.from(codemetaFile.data.content, "base64").toString(),
      sha: codemetaFile.data.sha,
    }

    // return JSON.parse(Buffer.from(codemetaFile.data.content, "base64").toString());
  } catch (error) {
    throw new Error("Error getting codemeta.json file", error);
  }
}

export async function getCitationContent(context, owner, repository) {
 try {
  const citationFile = await context.octokit.repos.getContent({
    owner,
    path: "CITATION.cff",
    repo: repository.name,
  });

  return {
    content: Buffer.from(citationFile.data.content, "base64").toString(),
    sha: citationFile.data.sha,
  }
 } catch (error) {
    throw new Error("Error getting CITATION.cff file", error);
 }
}

export async function validateMetadata(content, fileType) {
  if (fileType === "codemeta") {
    try {
      JSON.parse(content);
      // Verify the required fields are present
      if (!content.name || !content.authors || !content.description) {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }
  
  if (fileType === "citation") {
    try {
      yaml.load(content);
      // Verify the required fields are present
      if (!content.title || !content.authors) {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

}

export async function updateMetadataIdentifier(context, owner, repository, identifier, version) {
  try {
  // Get the citation file
  const citationObj = await getCitationContent(context, owner, repository);
  const codeMetaObj = await getCodemetaContent(context, owner, repository);

  let codeMetaFile = JSON.parse(codeMetaObj.content);
  const codeMetaSha = codeMetaObj.sha || null;

  let citationFile = yaml.load(citationObj.content);
  const citationSha = citationObj.sha || null;
  const updated_date = new Date().toISOString().split('T')[0];

  const zenodoMetadata = await dbInstance.zenodoDeposition.findUnique({
    where: {
      repository_id: repository.id,
    }
  })

  if (!zenodoMetadata) {
    throw new Error("Zenodo metadata not found in the database. Please create a new Zenodo deposition.");
  }

  citationFile.doi = identifier;
  citationFile["date-released"] = updated_date;
  citationFile.version = zenodoMetadata?.zenodo_metadata?.version || version;
  codeMetaFile.identifier = identifier;
  codeMetaFile.version = zenodoMetadata?.zenodo_metadata?.version || version;
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
    content: Buffer.from(yaml.dump(citationFile, { noRefs: true, indent: 2 })).toString("base64"),
    sha: citationSha,
  });

  consola.success("CITATION.cff file updated with Zenodo identifier");

  // Update the codemeta file
  await context.octokit.repos.createOrUpdateFileContents({
    owner,
    repo: repository.name,
    path: "codemeta.json",
    message: "chore: 📝 Update codemeta.json with Zenodo identifier",
    content: Buffer.from(JSON.stringify(codeMetaFile, null, 2)).toString("base64"),
    sha: codeMetaSha,
  });

  consola.success("codemeta.json file updated with Zenodo identifier");

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
  existingCodemeta.metadata.currentVersion = zenodoMetadata?.zenodo_metadata?.version || version

  // Update the database with the latest metadata
  await dbInstance.codeMetadata.update({
    where: {
      repository_id: repository.id,
    },
    data: {
      metadata: existingCodemeta.metadata,
    }
  })

  return codeMetaFile;
  } catch (error) {
    throw new Error(`Error on updating the GitHub metadata files: ${error}`, { cause: error })
  }

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
  context,
) {
  if ((!subjects.codemeta || !subjects.citation) && subjects.license) {
    // License was found but no codemeta.json or CITATION.cff exists
    const identifier = createId();
    let validCitation = false;
    let validCodemeta = false;

    let url = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/code-metadata`;

    const existingMetadata = await dbInstance.codeMetadata.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (subjects.codemeta) {
      try {
        const codemetaFile = await context.octokit.repos.getContent({
          owner,
          path: "codemeta.json",
          repo: repository.name,
        });

        JSON.parse(Buffer.from(codemetaFile.data.content, "base64").toString());

        validCodemeta = true;
      } catch (error) {
        consola.error("Error getting codemeta.json file", error);
      }
    }

    if (subjects.citation) {
      try {
        const citationFile = await context.octokit.repos.getContent({
          owner,
          path: "CITATION.cff",
          repo: repository.name,
        });

        yaml.load(Buffer.from(citationFile.data.content, "base64").toString());
        validCitation = true;
      } catch (error) {
        consola.error("Error getting CITATION.cff file", error);
      }
    }

    if (!existingMetadata) {
      // Entry does not exist in db, create a new one
      const gatheredMetadata = await gatherMetadata(context, owner, repository);
      await dbInstance.codeMetadata.create({
        data: {
          citation_status: validCitation ? "valid" : "invalid",
          codemeta_status: validCodemeta ? "valid" : "invalid",
          contains_citation: subjects.citation,
          identifier,
          contains_codemeta: subjects.codemeta,
          contains_metadata: subjects.codemeta && subjects.citation,
          metadata: gatheredMetadata,
          repository: {
            connect: {
              id: repository.id,
            },
          },
        },
      });
    } else {
      // Get the identifier of the existing metadata request
      await dbInstance.codeMetadata.update({
        data: {
          citation_status: validCitation ? "valid" : "invalid",
          codemeta_status: validCodemeta ? "valid" : "invalid",
          contains_citation: subjects.citation,
          contains_codemeta: subjects.codemeta,
          contains_metadata: subjects.codemeta && subjects.citation,
        },
        where: { repository_id: repository.id },
      });

      if (existingMetadata?.identifier) {
        url = `${CODEFAIR_DOMAIN}/add/code-metadata/${existingMetadata.identifier}`;
      }
    }
    const metadataBadge = `[![Metadata](https://img.shields.io/badge/Add_Metadata-dc2626.svg)](${url})`;
    baseTemplate += `\n\n## Metadata ❌\n\nTo make your software FAIR, a CITATION.cff and codemeta.json are expected at the root level of your repository. These files are not found in the repository. If you would like Codefair to add these files, click the "Add metadata" button below to go to our interface for providing metadata and generating these files.\n\n${metadataBadge}`;
  }

  if (subjects.codemeta && subjects.citation && subjects.license) {
    const codemetaContent = await getCodemetaContent(context, owner, repository);
    // const citationContent = await getCitationContent(context, owner, repository);

    const validCodemeta = true;
    const validCitation = true;

    // Convert the content to the structure we use for code metadata
    const metadata = await convertCodemetaForDB(JSON.parse(codemetaContent.content), repository);

    // Fetch license details from database
    const license = await dbInstance.licenseRequest.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (license?.license_id) {
      metadata.license = `https://spdx.org/licenses/${license.license_id}`;
    }

    // License, codemeta.json and CITATION.cff files were found
    const identifier = createId();

    let url = `${CODEFAIR_DOMAIN}/add/code-metadata/${identifier}`;

    const existingMetadata = await dbInstance.codeMetadata.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (!existingMetadata) {
      // Entry does not exist in db, create a new one
      const newDate = new Date();
      // const gatheredMetadata = await gatherMetadata(context, owner, repository);
      await dbInstance.codeMetadata.create({
        data: {
          citation_status: validCitation ? "valid" : "invalid",
          codemeta_status: validCodemeta ? "valid" : "invalid",
          contains_citation: subjects.citation,
          contains_codemeta: subjects.codemeta,
          contains_metadata: subjects.codemeta && subjects.citation,
          created_at: newDate,
          identifier,
          metadata,
          repository: {
            connect: {
              id: repository.id,
            },
          },
          updated_at: newDate,
        },
      });
    } else {
      // Get the identifier of the existing metadata request
      await dbInstance.codeMetadata.update({
        data: {
          citation_status: validCitation ? "valid" : "invalid",
          codemeta_status: validCodemeta ? "valid" : "invalid",
          contains_citation: subjects.citation,
          contains_codemeta: subjects.codemeta,
          contains_metadata: subjects.codemeta && subjects.citation,
          metadata,
          updated_at: new Date(),
        },
        where: { repository_id: repository.id },
      });

      url = `${CODEFAIR_DOMAIN}/add/code-metadata/${existingMetadata.identifier}`;
    }
    const metadataBadge = `[![Metadata](https://img.shields.io/badge/Edit_Metadata-0ea5e9.svg)](${url}?)`;
    baseTemplate += `\n\n## Metadata ✔️\n\nA CITATION.cff and a codemeta.json file are found in the repository. They may need to be updated over time as new people are contributing to the software, etc.\n\n${metadataBadge}`;
  }

  if (!subjects.license) {
    // License was not found
    const metadataBadge = `![Metadata](https://img.shields.io/badge/Metadata_Not_Checked-fbbf24)`;
    baseTemplate += `\n\n## Metadata\n\nTo make your software FAIR a CITATION.cff and codemeta.json metadata files are expected at the root level of your repository. Codefair will check for these files after a license file is detected.\n\n${metadataBadge}`;
  }

  return baseTemplate;
}
