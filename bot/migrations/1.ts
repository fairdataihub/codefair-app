/**
 * @description Update variables from camelCase to snake_case
 */

import { MongoClient } from "mongodb";

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

  console.log(
    "Replacing 'installationId' with 'installation_id' in the 'installation' collection",
  );

  // Get all the records where the 'installationId' field exists
  const installationsWithInstallationId = await installationCollection
    .find({
      installationId: { $exists: true },
    })
    .toArray();

  // Iterate over each record
  installationsWithInstallationId.forEach(async (installation) => {
    // Insert the changes we are going to make into the 'migratedData' collection
    await migratedDataCollection.insertOne({
      collection: "installation",
      document_id: installation._id,
      field: "installation_id",
      migration_id: migrationId,
      text: "Update the 'installationId' field to 'installation_id'",
      value: installation.installationId,
    });

    // Update the 'installationId' field to 'installation_id'
    await installationCollection.updateOne(
      { _id: installation._id },
      {
        $set: {
          installation_id: installation.installationId,
        },
      },
    );

    // Delete the 'installationId' field
    await installationCollection.updateOne(
      { _id: installation._id },
      {
        $unset: {
          installationId: "",
        },
      },
    );
  });
};

export default migrationFunction;
