import dbInstance from '../db.js';

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
const { ZENODO_ENDPOINT, ZENODO_API_ENDPOINT } = process.env;

export async function releaseGitHubDraft(context, owner, repository, tagVersion) {
  const release = await context.octokit.repos.createRelease({
    owner,
    repo: repository.name,
    tag_name: tagVersion,
    name: tagVersion,
    draft: false,
  })
}

/**
 * 
 * @param {Object} subjects - Subjects of the repository
 * @param {String} baseTemplate - Base template for the issue
 * @param {Object} repository - GitHub repository information
 * @param {String} owner - GitHub owner
 * @param {Object} context - GitHub context
 * @returns {String} String of updated base template with archival information
 */
export async function applyArchivalTemplate(
  subjects,
  baseTemplate,
  repository,
  owner,
  context,
) {
  const zenDepositionCollection = dbInstance.zenodoDeposition;
  const badgeURL = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/release/zenodo`;
  const archiveTitle = `\n\n## FAIR Software Release\n\n`;
  const existingZenodoDep = await zenDepositionCollection.findUnique({
    where: {
      repository_id: repository.id,
    }
  });
  const alreadyReleaseText = ` of your software was successfully released on GitHub and archived on Zenodo. You can view the Zenodo archive by clicking the button below:`
  const releaseBadgeButton = `[![Create Release](https://img.shields.io/badge/Create_Release-00bcd4.svg)](${badgeURL})`
  const newReleaseText = `To make your software FAIR, it is necessary to archive it in a archival repository like Zenodo every time you make a release. When you are ready to make your next release, click the "Create release" button below to easily create a FAIR release where your metadata files are updated (including with a DOI) before creating a GitHub release and archiving it.\n\n`

  if (!existingZenodoDep) {
    // Entry does not exist in db, create a new one
    await zenDepositionCollection.create({
      data: {
        repository_id: repository.id,
        existing_zenodo_deposition_id: false,
        zenodo_id: null,
        zenodo_metadata: {},
        github_release_id: null,
        github_tag_name: null,
        user_id: "",
      }
    })
    baseTemplate += `${archiveTitle}${newReleaseText}\n\n${releaseBadgeButton}`;
  } else {
    // entry does exist, update the existing one
    await zenDepositionCollection.update({
      data: {
        existing_zenodo_deposition_id: true,
        zenodo_id: existingZenodoDep.zenodo_id,
      },
      where: {
        repository_id: repository.id,
      }
    });

    const lastVersion = existingZenodoDep.github_tag_name;
    const zenodoId = existingZenodoDep.zenodo_id;
    const zenodoUrl = `${ZENODO_ENDPOINT}/record/${zenodoId}`;
    const zenodoDOIBadge = `[![DOI](https://zenodo.org/badge/${zenodoId}.svg)](${zenodoUrl})`;
    baseTemplate += `${archiveTitle}\n\n***${lastVersion}***${alreadyReleaseText}\n\n${zenodoDOIBadge}\n\nReady to create your next FAIR release? Click the button below:\n\n${releaseBadgeButton} `;
  }

  // baseTemplate = `${archiveTitle}${newReleaseText}\n\n${alreadyReleaseText}`;
  return baseTemplate;
}

/**
 * * Fetches the Zenodo deposition info, creates a new Zenodo deposition if the deposition ID is "new" or creates a new version of an existing Zenodo deposition
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Zenodo API token
 * @returns {Object} Object of Zenodo deposition info
 */
export async function getZenodoDepositionInfo(
  depositionId,
  zenodoToken,
) {
  if (depositionId === "new") {
    try {
      // Create new Zenodo deposition
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
      consola.error("Error creating new Zenodo deposition:", error);
      return;
    }
  } else {
    try {
      // Fetch existing Zenodo deposition
      const zenodoDeposition = await fetch(
        `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}`,
        {
          method: "GET",
          params: { 'access_token': zenodoToken },
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const zenodoDepositionInfo = await zenodoDeposition.json();

      // Check if the deposition is published
      if (zenodoDepositionInfo.submitted === false){
        // Delete the draft
          try {
          await fetch(
            `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}`,
            {
              method: "DELETE",
              params: { 'access_token': zenodoToken },
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
          } catch (error) {
            consola.error("Error deleting the draft deposition:", error);
            return;
          }
      }

      // Create a new version of an existing Zenodo deposition
      try {
        const zenodoRecord = await fetch(
          `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}/actions/newversion`,
          {
            method: "POST",
            params: { 'access_token': zenodoToken },
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
        zenodoDepositionInfo = await zenodoRecord.json();
        return zenodoDepositionInfo;
      } catch (error) {
        consola.error("Error creating new version of Zenodo deposition:", error);
        return;
      }
    } catch (error) {
      consola.error("Error fetching the Zenodo deposition:", error);
      return;
    }
  }
}

/**
 * * Creates metadata for Zenodo deposition - based on the codemeta.json file
 * @param {String} codemetadata - Code metadata JSON string (parse with JSON.parse) 
 * @returns {Object} Object of Zenodo metadata
 */
export async function getZenodoMetadata(codemetadata) {
  const new_date = new Date().toISOString().split('T')[0];
  const codeMetaContent = JSON.parse(codemetadata);
  const zenodoCreators = codeMetaContent.author.map((author) => {
    let tempObj = {};
    tempObj.name = `${author.familyName}, ${author.givenName}`;
  
    if (author.affiliation) {
      tempObj.affiliation = author.affiliation;
    }
  
    if (author.orcid && author.orcid !== "") {
      tempObj.orcid = author.orcid;
    }
  
    return tempObj;
  });

  const license = licensesJson.find((license) => license.detailsUrl === `${codeMetaContent.license}.json`);
  const licenseId = license ? license.licenseId : null;

  if (!licenseId) {
    throw new Error(`License not found for URL: ${codeMetaContent.license}`);
  }

  const newZenodoMetadata = {
    metadata: {
      title: codeMetaContent?.name,           // Now accessing "name" from the parsed object
      description: codeMetaContent?.description,
      upload_type: "software",
      creators: zenodoCreators,
      access_right: "open",
      publication_date: new_date,
      license: licenseId,
    }
  }

  return newZenodoMetadata;
}

export async function updateZenodoMetadata(depositionId, zenodoToken, metadata) {
  try {
    const updatedMetadata = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}`,
      {
        method: "PUT",
        params: { 'access_token': zenodoToken },
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      },
    );

    consola.success("Zenodo deposition metadata updated successfully!");
    const updatedMetadataInfo = await updatedMetadata.json();
    return updatedMetadataInfo;
  } catch (error) {
    consola.error("Error updating Zenodo metadata:", error);
    return;
  }
}

export async function uploadReleaseAssetsToZenodo(
  depositionId,
  zenodoToken,
  draftReleaseAssets,
  repositoryArchive,
  owner,
  context,
  bucket_url,
) {
  for (const asset of draftReleaseAssets) {
    // Download the raw file from GitHub
    const { data: assetData } = await context.octokit.repos.getReleaseAsset({
        owner,
        repo: repository.name,
        asset_id: asset.id,
        headers: {
        accept: 'application/octet-stream'
      }
    });

    // Upload the file to Zenodo
    consola.start(`Uploading ${asset.name} to Zenodo...`);
    const uploadAsset = await fetch(`${bucket_url}/${asset.name}`,
      {
        method: "PUT",
        body: assetData,  // Upload the raw file directly
        headers: {
          Authorization: `Bearer ${zenodoToken}`, // Specify the correct content type
        },
      }
    );

    if (!uploadAsset.ok) {
      consola.error(`Failed to upload ${asset.name}. Status: ${uploadAsset.statusText}. Error: ${uploadAsset}`);
    } else {
      consola.success(`${asset.name} successfully uploaded to Zenodo!`);
      consola.success(uploadAsset);
    }
  }
}