import { dbInstance } from '../db';
import { createId } from '../utils/tools';

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;

export async function createArchivalTemplate(
  subjects,
  baseTemplate,
  repository,
  owner,
  context,
) {
  const zenDepositionCollection = dbInstance.zenododeposition;
  const badgeURL = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/zenodo`;
  const existingZenodoDep = await zenDepositionCollection.findUnique({
    where: {
      repository_id: repository.id,
    }
  });

  if (!existingZenodoDep) {
    // Entry does not exist in db, create a new one
    await zenDepositionCollection.create({
      data: {
        repository_id: repository.id,
        existing_zenodo_deposition: false,
        zenodo_id: null,
        zenodo
      }
    })
  } else {
    // entry does exist, update the existing one
    await zenDepositionCollection.update({
      date: {
        existing_zenodo_deposition: true,
        zenodo_id: existingZenodoDep.zenodo_id,
      },
      where: {
        repository_id: repository.id,
      }
    });
  }

  const badgeButton = `[![Archive & Release on Zenodo](${badgeURL})](${badgeURL})`;
}