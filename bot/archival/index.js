import { dbInstance } from "../db.js";

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;

export async function createArchivalTemplate(
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
  const archiveTitle = `## Software Archival\n\nMake a GitHub release and archive the software on Zenodo.`;

  // No existing archive, so create a new one
  if (!existingArchive) {
    await archiveCollection.insertOne({
      badgeURL,
      created_at: currentDate,
      identifier,
      owner,
      repository,
      repositoryId: repository.id,
      subjects,
      updated_at: currentDate,
    });
  } else {
    await archiveCollection.updateOne(
      { repositoryId: repository.id },
      {
        $set: {
          repository, // In the case that the repository name has changed
          updated_at: currentDate,
        },
      },
    );

    badgeURL = `${CODEFAIR_DOMAIN}/add/archive/${existingArchive.identifier}`;
  }

  const badgeButton = `[![Archive & Release Software](${badgeURL})](${badgeURL})`;
  baseTemplate += `${archiveTitle}\n\nCodefair provides a seamless workflow to create a GitHub release and archive the software on Zenodo with the latest version and metadata. Click the button below to get started.\n\n${badgeButton}\n\n`;
  return baseTemplate;
}
