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
      value: installation.installationId,
      migration_id: migrationId,
      text: "Update the 'installationId' field to 'installation_id'",
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

  // Get all the records where the 'repositoryId' field exists
  const installationsWithRepositoryId = await installationCollection
    .find({
      repositoryId: { $exists: true },
    })
    .toArray();

  // Iterate over each record
  installationsWithRepositoryId.forEach(async (installation) => {
    // Insert the changes we are going to make into the 'migratedData' collection
    await migratedDataCollection.insertOne({
      collection: "installation",
      document_id: installation._id,
      field: "repository_id",
      value: installation.repositoryId,
      migration_id: migrationId,
      text: "Update the 'repositoryId' field to 'repository_id'",
    });

    // Update the 'repositoryId' field to 'repository_id'
    await installationCollection.updateOne(
      { _id: installation._id },
      {
        $set: {
          repository_id: installation.repositoryId,
        },
      },
    );

    // Delete the 'repositoryId' field
    await installationCollection.updateOne(
      { _id: installation._id },
      {
        $unset: {
          repositoryId: "",
        },
      },
    );
  });

  const codeMetadataCollection = database.collection("codeMetadata");

  // Get all the records where the 'repositoryId' field exists
  const codeMetadataRecordsWithRepositoryId = await codeMetadataCollection
    .find({
      repositoryId: { $exists: true },
    })
    .toArray();

  // Iterate over each record
  codeMetadataRecordsWithRepositoryId.forEach(async (codeMetadata) => {
    // Insert the changes we are going to make into the 'migratedData' collection
    await migratedDataCollection.insertOne({
      collection: "codeMetadata",
      document_id: codeMetadata._id,
      field: "repository_id",
      value: codeMetadata.repositoryId,
      migration_id: migrationId,
      text: "Update the 'repositoryId' field to 'repository_id'",
    });

    // Update the 'repositoryId' field to 'repository_id'
    await codeMetadataCollection.updateOne(
      { _id: codeMetadata._id },
      {
        $set: {
          repository_id: codeMetadata.repositoryId,
        },
      },
    );

    // Delete the 'repositoryId' field
    await codeMetadataCollection.updateOne(
      { _id: codeMetadata._id },
      {
        $unset: {
          repositoryId: "",
        },
      },
    );
  });

  const cwlValidationCollection = database.collection("cwlValidation");

  // Get all the records where the 'repositoryId' field exists
  const cwlValidationRecordsWithRepositoryId = await cwlValidationCollection
    .find({
      repositoryId: { $exists: true },
    })
    .toArray();

  // Iterate over each record
  cwlValidationRecordsWithRepositoryId.forEach(async (cwlValidation) => {
    // Insert the changes we are going to make into the 'migratedData' collection
    await migratedDataCollection.insertOne({
      collection: "cwlValidation",
      document_id: cwlValidation._id,
      field: "repository_id",
      value: cwlValidation.repositoryId,
      migration_id: migrationId,
      text: "Update the 'repositoryId' field to 'repository_id'",
    });

    // Update the 'repositoryId' field to 'repository_id'
    await cwlValidationCollection.updateOne(
      { _id: cwlValidation._id },
      {
        $set: {
          repository_id: cwlValidation.repositoryId,
        },
      },
    );

    // Delete the 'repositoryId' field
    await cwlValidationCollection.updateOne(
      { _id: cwlValidation._id },
      {
        $unset: {
          repositoryId: "",
        },
      },
    );
  });

  const licenseRequestsCollection = database.collection("licenseRequests");

  // Get all the records where the 'repositoryId' field exists
  const licenseRequestsRecordsWithRepositoryId = await licenseRequestsCollection
    .find({
      repositoryId: { $exists: true },
    })
    .toArray();

  // Iterate over each record
  licenseRequestsRecordsWithRepositoryId.forEach(async (licenseRequest) => {
    // Insert the changes we are going to make into the 'migratedData' collection
    await migratedDataCollection.insertOne({
      collection: "licenseRequests",
      document_id: licenseRequest._id,
      field: "repository_id",
      value: licenseRequest.repositoryId,
      migration_id: migrationId,
      text: "Update the 'repositoryId' field to 'repository_id'",
    });

    // Update the 'repositoryId' field to 'repository_id'
    await licenseRequestsCollection.updateOne(
      { _id: licenseRequest._id },
      {
        $set: {
          repository_id: licenseRequest.repositoryId,
        },
      },
    );

    // Delete the 'repositoryId' field
    await licenseRequestsCollection.updateOne(
      { _id: licenseRequest._id },
      {
        $unset: {
          repositoryId: "",
        },
      },
    );
  });

  // Get all the records where the 'licenseContent' field exists
  const licenseRequestsRecordsWithLicenseContent =
    await licenseRequestsCollection
      .find({
        licenseContent: { $exists: true },
      })
      .toArray();

  // Iterate over each record

  licenseRequestsRecordsWithLicenseContent.forEach(async (licenseRequest) => {
    // Insert the changes we are going to make into the 'migratedData' collection
    await migratedDataCollection.insertOne({
      collection: "licenseRequests",
      document_id: licenseRequest._id,
      field: "license_content",
      value: licenseRequest.licenseContent,
      migration_id: migrationId,
      text: "Update the 'licenseContent' field to 'license_content'",
    });

    // Update the 'licenseContent' field to 'license_content'
    await licenseRequestsCollection.updateOne(
      { _id: licenseRequest._id },
      {
        $set: {
          license_content: licenseRequest.licenseContent,
        },
      },
    );

    // Delete the 'licenseContent' field
    await licenseRequestsCollection.updateOne(
      { _id: licenseRequest._id },
      {
        $unset: {
          licenseContent: "",
        },
      },
    );
  });

  // Get all the records where the 'licenseId' field exists
  const licenseRequestsRecordsWithLicenseId = await licenseRequestsCollection
    .find({
      licenseId: { $exists: true },
    })
    .toArray();

  // Iterate over each record
  licenseRequestsRecordsWithLicenseId.forEach(async (licenseRequest) => {
    // Insert the changes we are going to make into the 'migratedData' collection
    await migratedDataCollection.insertOne({
      collection: "licenseRequests",
      document_id: licenseRequest._id,
      field: "license_id",
      value: licenseRequest.licenseId,
      migration_id: migrationId,
      text: "Update the 'licenseId' field to 'license_id'",
    });

    // Update the 'licenseId' field to 'license_id'
    await licenseRequestsCollection.updateOne(
      { _id: licenseRequest._id },
      {
        $set: {
          license_id: licenseRequest.licenseId,
        },
      },
    );

    // Delete the 'licenseId' field
    await licenseRequestsCollection.updateOne(
      { _id: licenseRequest._id },
      {
        $unset: {
          licenseId: "",
        },
      },
    );
  });

  // Get all the records where the 'pullRequestURL' field exists
  const licenseRequestsRecordsWithPullRequestURL =
    await licenseRequestsCollection
      .find({
        pullRequestURL: { $exists: true },
      })
      .toArray();

  // Iterate over each record
  licenseRequestsRecordsWithPullRequestURL.forEach(async (licenseRequest) => {
    // Insert the changes we are going to make into the 'migratedData' collection
    await migratedDataCollection.insertOne({
      collection: "licenseRequests",
      document_id: licenseRequest._id,
      field: "pull_request_url",
      value: licenseRequest.pullRequestURL,
      migration_id: migrationId,
      text: "Update the 'pullRequestURL' field to 'pull_request_url'",
    });

    // Update the 'pullRequestURL' field to 'pull_request_url'
    await licenseRequestsCollection.updateOne(
      { _id: licenseRequest._id },
      {
        $set: {
          pull_request_url: licenseRequest.pullRequestURL,
        },
      },
    );

    // Delete the 'pullRequestURL' field
    await licenseRequestsCollection.updateOne(
      { _id: licenseRequest._id },
      {
        $unset: {
          pullRequestURL: "",
        },
      },
    );
  });

  // Delete the `open` field from the `licenseRequests` collection if it exists
  await licenseRequestsCollection.updateMany(
    {
      open: { $exists: true },
    },
    {
      $unset: {
        open: "",
      },
    },
  );
};

export default migrationFunction;
