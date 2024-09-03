/**
 * @description Update variables from camelCase to snake_case
 */

import { MongoClient } from "mongodb";
import { consola } from "consola";

const migrationFunction = async (
  dbUri: string,
  dbName: string,
  migrationId: string,
) => {
  // Create a new MongoClient
  const client = new MongoClient(dbUri);

  await client.connect();

  const database = client.db(dbName);

  const migratedDataCollection = database.collection("migratedData");

  const installationCollection = database.collection("installation");

  consola.start(
    "Adding 'action_count' to entries in the 'installation' collection",
  );

  // Get all the records where the 'installationId' field exists
  const installationsWithoutActionCount = await installationCollection
    .find({
      action_count: { $exists: false },
    })
    .toArray();

  // Iterate over each record
  for (const installation of installationsWithoutActionCount) {
    // Insert the changes we are going to make into the 'migratedData' collection
    consola.info(`Updating ${installation.repo} entry`);
    await migratedDataCollection.insertOne({
      collection: "installation",
      document_id: installation._id,
      field: "installation_id",
      migration_id: migrationId,
      text: "Set action_count to 0",
      value: null,
    });

    // Update the 'installationId' field to 'installation_id'
    await installationCollection.updateOne(
      { _id: installation._id },
      {
        $set: {
          action_count: 0,
        },
      },
    );
  }
  // installationsWithoutActionCount.forEach(async (installation) => {
  //   // Insert the changes we are going to make into the 'migratedData' collection
  //   await migratedDataCollection.insertOne({
  //     collection: "installation",
  //     document_id: installation._id,
  //     field: "installation_id",
  //     migration_id: migrationId,
  //     text: "Set action_count to 0",
  //     value: null,
  //   });

  //   // Update the 'installationId' field to 'installation_id'
  //   await installationCollection.updateOne(
  //     { _id: installation._id },
  //     {
  //       $set: {
  //         action_count: 0,
  //       },
  //     },
  //   );
  // });

  consola.success(
    "Add action_count key entries in the 'installation' collection",
  );

  return installationsWithoutActionCount.length;
};

export default migrationFunction;
