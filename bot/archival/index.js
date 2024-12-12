import dbInstance from '../db.js';
import { consola } from 'consola';
import { logwatch } from '../utils/logwatch.js';
import fs from 'fs';
const licensesJson = JSON.parse(fs.readFileSync('./public/assets/data/licenses.json', 'utf8'));

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
const { ZENODO_ENDPOINT, ZENODO_API_ENDPOINT } = process.env;

/**
 * * Update the GitHub release to not be a draft
 * @param {String} repositoryName - GitHub repository name
 * @param {String} owner - GitHub owner
 * @param {String} releaseId - GitHub release ID 
 */
export async function updateGitHubRelease(context, repositoryName, owner, releaseId) {
  try {
    await context.octokit.repos.updateRelease({
      owner,
      repo: repositoryName,
      release_id: releaseId,
      draft: false,
    });
    logwatch.success("Updated release to not be a draft!");
  } catch (error) {
    throw new Error(`Error updating the GitHub release: ${error}`, { cause: error });
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
    const publishDeposition = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}/actions/publish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${zenodoToken}`,
        },
      }
    );

    if (!publishDeposition.ok) {
      throw new Error(`Failed to publish the Zenodo deposition. Status: ${publishDeposition.status}: ${publishDeposition.statusText}, Error: ${JSON.stringify(publishDeposition)}`, { cause: publishDeposition });
    }

    const publishedDeposition = await publishDeposition.json();
    logwatch.success(`Zenodo deposition published successfully at: ${publishedDeposition.links.latest_html}`);
  } catch (error) {
    throw new Error(`Error publishing the Zenodo deposition: ${error.message}`, { cause: error });
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
      }
    });
  
    if (!deposition || !deposition.token) {
      throw new Error(`Deposition with tag ${tagVersion} not found in db.`, { cause: error });
    }

    const zenodoTokenInfo = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions?access_token=${deposition.token}`,
      {
        method: "GET",
      },
    );
  
    if (!zenodoTokenInfo) {
      throw new Error(`Zenodo token not found`, { cause: error });
    }
  
    return deposition.token;
  } catch (error) {
    throw new Error(`Error fetching the Zenodo token: ${error.message}`, { cause: error });
  }
}

/**
 * * Parse the Zenodo information from the GitHub issue body
 * @param {String} issueBody - GitHub issue body 
 * @returns {Object} Object of Zenodo deposition information
 */
export function parseZenodoInfo(issueBody) {
  // Gather the information for the Zenodo deposition provided in the issue body
  const match = issueBody.match(/<!--\s*@codefair-bot\s*publish-zenodo\s*([\s\S]*?)-->/);
  if (!match) {
    throw new Error("Zenodo publish information not found in issue body.");
  }
  const [depositionId, releaseId, tagVersion, userWhoSubmitted] = match[1].trim().split(/\s+/);

  return { depositionId, releaseId, tagVersion, userWhoSubmitted };
}

/**
 * * Apply the archival template to the base template
 * @param {Object} subjects - Subjects of the repository
 * @param {String} baseTemplate - Base template for the issue
 * @param {Object} repository - GitHub repository information
 * @param {String} owner - GitHub owner
 * @param {Object} context - GitHub context
 * @returns {String} String of updated base template with archival information
 */
export async function applyArchivalTemplate(
  baseTemplate,
  repository,
  owner,
) {
  const archiveTitle = `\n\n## FAIR Software Release`;
  const badgeURL = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/release/zenodo`;
  const existingZenodoDep = await dbInstance.zenodoDeposition.findUnique({
    where: {
      repository_id: repository.id,
    }
  });
  const alreadyReleaseText = ` of your software was successfully released on GitHub and archived on Zenodo. You can view the Zenodo archive by clicking the button below:`
  const firstReleaseBadgeButton = `[![Create Release](https://img.shields.io/badge/Create_Release-dc2626.svg)](${badgeURL})`
  const releaseBadgeButton = `[![Create Release](https://img.shields.io/badge/Create_Release-00bcd4.svg)](${badgeURL})`
  const newReleaseText = `To make your software FAIR, it is necessary to archive it in an archival repository like Zenodo every time you make a release. When you are ready to make your next release, click the "Create release" button below to easily create a FAIR release where your metadata files are updated (including with a DOI) before creating a GitHub release and archiving it.\n\n`

  if (!existingZenodoDep && !existingZenodoDep?.last_published_zenodo_doi != null) {
    // Entry does not exist in db, create a new one
    // await zenDepositionCollection.create({
    //   data: {
    //     repository_id: repository.id,
    //     existing_zenodo_deposition_id: null,
    //     zenodo_id: null,
    //     zenodo_metadata: {},
    //     github_release_id: null,
    //     github_tag_name: null,
    //     user_id: "",
    //   }
    // });
    baseTemplate += `${archiveTitle} ❌\n\n${newReleaseText}\n\n${firstReleaseBadgeButton}`;
  } else {
    // entry does exist, update the existing one
    await dbInstance.zenodoDeposition.update({
      data: {
        existing_zenodo_deposition_id: true,
        zenodo_id: existingZenodoDep.zenodo_id,
      },
      where: {
        repository_id: repository.id,
      }
    });

    // Fetch the DOI content
    const lastVersion = existingZenodoDep.github_tag_name;
    const zenodoId = existingZenodoDep.zenodo_id;
    const zenodoDoi = existingZenodoDep.last_published_zenodo_doi;
    const zenodoDOIBadge = `[![DOI](https://img.shields.io/badge/DOI-${zenodoDoi}-blue)](${ZENODO_ENDPOINT}/records/${zenodoId})`;
    baseTemplate += `${archiveTitle} ✔️\n\n***${lastVersion}***${alreadyReleaseText}\n\n${zenodoDOIBadge}\n\nReady to create your next FAIR release? Click the button below:\n\n${releaseBadgeButton} `;
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
    const zenodoRecord = await fetch(`${ZENODO_API_ENDPOINT}/deposit/depositions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${zenodoToken}`,
      },
      body: JSON.stringify({}),
    });
  
    const zenodoDepositionInfo = await zenodoRecord.json();
    return zenodoDepositionInfo;
  } catch (error) {
    throw new Error(`Error creating a new Zenodo deposition: ${error}`, { cause: error });
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
    const zenodoDeposition = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${zenodoToken}`,
        },
      },
    );
  
    if (!zenodoDeposition.ok) {
      const errorText = await zenodoDeposition.text();
      throw new Error(`Failed to fetch the Zenodo deposition. Status: ${zenodoDeposition.status}: ${zenodoDeposition.statusText}. Error: ${errorText}`);
    }
  
    const zenodoDepositionInfo = await zenodoDeposition.json();
    return zenodoDepositionInfo;
  } catch (error) {
    throw new Error(`Error fetching the Zenodo deposition: ${error}`, { cause: error });
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
    const zenodoRecord = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}/actions/newversion`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${zenodoToken}`,  // Use Authorization header instead of query parameter
        },
      },
    );
  
    if (!zenodoRecord.ok) {
      const errorText = await zenodoRecord.text();
      throw new Error(`Failed to create a new version of Zenodo deposition. Status: ${zenodoRecord.status}: ${zenodoRecord.statusText}.`, { cause: errorText});
    }
    logwatch.success("New version of Zenodo deposition created successfully!");
  
    const responseText = await zenodoRecord.json();

    // Fetch the latest draft
    const draftZenodoRecord = await fetch(responseText.links.latest_draft, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${zenodoToken}`,
      },
    });

    if (!draftZenodoRecord.ok) {
      logwatch.error({message: "Error fetching the latest draft of Zenodo deposition:", fetchReponse: draftZenodoRecord}, true);
      const errorText = await draftZenodoRecord.text();
      throw new Error(`Failed to fetch the latest draft of Zenodo deposition. Status: ${draftZenodoRecord.status}: ${draftZenodoRecord.statusText}. Error: ${errorText}`, { cause: errorText });
    }

    return await draftZenodoRecord.json();
  } catch (error) {
    throw new Error(`Error creating a new version of Zenodo deposition: ${error}`, { cause: error });
  }
}

/**
 * * Returns the latest draft deposition of a new or existing Zenodo deposition. Files are deleted from the latest draft deposition.
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Zenodo API token
 * @returns {Object} Object of Zenodo deposition info
 */
export async function getZenodoDepositionInfo(
  depositionId,
  zenodoToken,
) {
  if (depositionId === "new") {
    const newZenodoDeposition = await createNewZenodoDeposition(zenodoToken);
    return newZenodoDeposition;
  } else {
    // Fetch existing Zenodo deposition
    const zenodoDepositionInfo = await fetchExistingZenodoDeposition(zenodoToken, depositionId);

    if (zenodoDepositionInfo.submitted === false){
      // Delete the files in the draft
      logwatch.start("Requested deposition is a draft. Deleting the files in the draft...");
      for (const file of zenodoDepositionInfo.files) {
        await deleteFileFromZenodo(depositionId, zenodoToken, file.id);
      }
      return zenodoDepositionInfo;
    }
      
    // Create a new version of an existing Zenodo deposition
    const newZenodoVersion = await createNewVersionOfDeposition(zenodoToken, depositionId);

    if (newZenodoVersion.files.length > 0) {
      for (const file of newZenodoVersion.files) {
        logwatch.start(`Deleting file from newly created draft: ${file.links.download}`);
        await deleteFileFromZenodo(newZenodoVersion.id, zenodoToken, file.id);
      }
    }

    logwatch.success("New draft version of Zenodo deposition created successfully!");
    return newZenodoVersion;
  }
}

/**
 * * Creates metadata for Zenodo deposition - based on the codemeta.json file
 * @param {String} codemetadata - Code metadata JSON string (parse with JSON.parse)
 * @returns {Object} Object of Zenodo metadata
 */
export async function createZenodoMetadata(codemetadata, repository) {
  try {
    const new_date = new Date().toISOString().split('T')[0];
    const codeMetaContent = codemetadata;
    const zenodoCreators = codeMetaContent.author.filter((author) => author?.type !== "Role").map((author) => {
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
      }
    });
    if (!codeMetaContent.license) {
      // fetch from the db
      logwatch.warn(`No license found in the codemeta.json file. Fetching from the database...`);
      logwatch.info(`License found in the database: ${existingLicense?.license_id}`);
      codeMetaContent.license = `https://spdx.org/licenses/${existingLicense?.license_id}`;
    }
    const license = licensesJson.find((license) => license.detailsUrl === `${codeMetaContent.license}.json`);
    const licenseId = license ? license.licenseId : null;
  
    if (!licenseId) {
      throw new Error(`License not found for URL: ${codeMetaContent.license}`, { cause: JSON.stringify(licenseId)});
    }
  
    const zenodoMetadata = await dbInstance.zenodoDeposition.findUnique({
      where: {
        repository_id: repository.id,
      }
    })
  
    if (!zenodoMetadata) {
      logwatch.error("Zenodo metadata not found in the database. Please create a new Zenodo deposition.");
      throw new Error("Zenodo metadata not found in the database. Please create a new Zenodo deposition.");
    }

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

  
    return {
      metadata: {
        title: codeMetaContent?.name,
        description: codeMetaContent?.description,
        upload_type: "software",
        creators: zenodoCreators,
        access_right: zenodoMetadata.zenodo_metadata.accessRight,
        publication_date: new_date,
        license: licenseId,
        version: zenodoMetadata.zenodo_metadata.version || codeMetaContent?.version,
      }
    }
  } catch (error) {
    throw new Error(`Error getting Zenodo metadata: ${error}`, { cause: error });
  }
}

/**
 * * Updates the Zenodo metadata for the deposition
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Access token for Zenodo API
 * @param {Object} metadata - Zenodo metadata object
 * @returns - Object of updated Zenodo metadata
 */
export async function updateZenodoMetadata(depositionId, zenodoToken, metadata) {
  try {
    const updatedMetadata = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}`,
      {
        method: "PUT",
        params: { 'access_token': zenodoToken },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${zenodoToken}`,
        },
        body: JSON.stringify(metadata),
      },
    );

    const updatedMetadataInfo = await updatedMetadata.json();
    logwatch.success("Zenodo deposition metadata updated successfully!");
    return updatedMetadataInfo;
  } catch (error) {
    throw new Error(`Error updating Zenodo metadata: ${error}`, { cause: error });
  }
}

/**
 * * Uploads the release assets to Zenodo deposition
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Access token for Zenodo API
 * @param {Array} draftReleaseAssets - List of objects containing the release assets information
 * @param {*} repositoryArchive - The repository archive file
 * @param {String} owner - GitHub owner
 * @param {Object} context - GitHub context
 * @param {String} bucket_url - Zenodo bucket URL
 */
export async function uploadReleaseAssetsToZenodo(
  zenodoToken,
  draftReleaseAssets,
  repositoryArchive,
  owner,
  context,
  bucket_url,
  repository,
  tagVersion,
) {
  const startTime = performance.now();
  if (draftReleaseAssets.length > 0) {
    for (const asset of draftReleaseAssets) {
      try {
        // Download the raw file from GitHub
        const { data: assetData } = await context.octokit.repos.getReleaseAsset({
          owner,
          repo: repository.name,
          asset_id: asset.id,
          headers: {
            accept: 'application/octet-stream'
          }
        });
        logwatch.success(`Asset data fetched for ${asset.name}, for the release ${tagVersion}, from the GitHub repository: ${repository.name}`);

        // Upload the file to Zenodo
        const uploadAsset = await fetch(`${bucket_url}/${asset.name}`,
          {
            method: "PUT",
            body: assetData,  // Upload the raw file directly
            headers: {
              Authorization: `Bearer ${zenodoToken}`, // Specify the correct content type
            },
        });
  
        if (!uploadAsset.ok) {
          logwatch.error(`Failed to upload ${asset.name}. Status: ${uploadAsset.statusText}. Error: ${uploadAsset}`);
        } else {
          logwatch.success(`${asset.name} successfully uploaded to Zenodo!`);
        }
      } catch (error) {
        throw new Error(`Error uploading assets to Zenodo: ${error}`, { cause: error });
      }
    }
  }

  // Upload the repository archive to Zenodo
  const uploadZip = await fetch(
    `${bucket_url}/${repository.name}-${tagVersion}.zip`,
    {
      method: "PUT",
      body: repositoryArchive,
      headers: {
        Authorization: `Bearer ${zenodoToken}`,
      },
    }
  );

  if (!uploadZip.ok) {
    logwatch.error(`Failed to upload zip file. Status: ${uploadZip.statusText}`);
    throw new Error(`Failed to upload zip file. Status: ${uploadZip.statusText}`);
  }

  const endTime = performance.now();
  logwatch.info(`Total duration to upload assets and zip to Zenodo deposition: ${(endTime - startTime) / 1000} seconds`);
  logwatch.success("Zip file successfully uploaded to Zenodo!");
}

/**
 * * Deletes a file from a Zenodo deposition
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Access token for Zenodo API
 * @param {String} fileId - Zenodo file ID
 */
export async function deleteFileFromZenodo(depositionId, zenodoToken, fileId) {
  try {
    const deleteFile = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}/files/${fileId}?access_token=${zenodoToken}`,
      {
        method: "DELETE",
        headers: {},
        body: JSON.stringify({}),
      },
    );
  
    if (!deleteFile.ok) {
      const errorText = await deleteFile.text();
      throw new Error(`Failed to delete file from Zenodo. Status: ${deleteFile.status}: ${deleteFile.statusText}. Error: ${errorText}`);
    }
  
    logwatch.success("File successfully deleted from Zenodo!");
  } catch (error) {
    throw new Error(`Error deleting file from Zenodo: ${error}`, { cause: error });
  }
}
