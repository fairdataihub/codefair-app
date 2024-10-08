import dbInstance from '../db.js';

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
const { ZENODO_ENDPOINT } = process.env;

export async function releaseGitHubDraft(context, owner, repository, tagVersion) {
  const release = await context.octokit.repos.createRelease({
    owner,
    repo: repository.name,
    tag_name: tagVersion,
    name: tagVersion,
    draft: false,
  })
}

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