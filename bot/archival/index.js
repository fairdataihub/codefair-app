import { createId } from "../utils/tools/index.js";
import dbInstance from "../db.js";

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;

export async function applyArchivalTemplate(
  subjects,
  baseTemplate,
  repository,
  owner,
  context,
) {
  const archiveCollection = dbInstance.getDb().collection("repoArchives");
  const identifier = createId();
  let badgeURL = `${CODEFAIR_DOMAIN}/add/archive/${identifier}`;
  const existingArchive = await archiveCollection.findOne({
    repositoryId: repository.id,
  });
  const currentDate = Date.now();
  const archiveTitle = `\n\n## Software Archival\n\nMake a GitHub release and archive the software on Zenodo.`;

  // No existing archive, so create a new one
  if (!existingArchive) {
    await archiveCollection.insertOne({
      contains_figshare_archive: false,
      contains_software_archive: false,
      contains_zenodo_archive: false,
      created_at: currentDate,
      identifier,
      owner,
      repositoryId: repository.id,
      updated_at: currentDate,
    });
  } else {
    await archiveCollection.updateOne(
      { repositoryId: repository.id },
      {
        $set: {
          contains_figshare_archive: false,
          contains_software_archive: false,
          contains_zenodo_archive: false,
          owner,
          repository, // In the case that the repository name has changed
          updated_at: currentDate,
        },
      },
    );

    badgeURL = `${CODEFAIR_DOMAIN}/add/archive/${existingArchive.identifier}`;
  }

  const badgeButton = `[![Release and Archive](https://img.shields.io/badge/Release_and_Archive-00bcd4.svg)](${badgeURL})`;
  baseTemplate += `${archiveTitle}\nCodefair provides a seamless workflow to create a GitHub release and archive the software on Zenodo with the latest version and metadata. Click the button below to get started.\n\n${badgeButton}\n\n`;
  return baseTemplate;
}
