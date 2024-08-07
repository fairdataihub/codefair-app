import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import fs from "fs";
import { nanoid } from "nanoid";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({
    path: ".env",
  });
}

if (!process.env.MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

if (!process.env.MONGODB_DB_NAME) {
  throw new Error("Please define the MONGODB_DB_NAME environment variable");
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;
const devDbName = `${dbName}-migrations-test`;

// Create a new MongoClient
const client = new MongoClient(uri);

await client.connect();

const database = client.db(dbName);

if (!database) {
  throw new Error("Database not found");
}

const devDatabase = client.db(devDbName);

// FOR DEV ONLY
// Clone the original database
// Get the list of collections in the original database
console.log("Cloning the original database");

const collections = await database.listCollections().toArray();

for (const collection of collections) {
  const collectionName = collection.name;

  // Get the collection
  const dbCollection = database.collection(collectionName);

  // Get the documents in the collection
  const documents = await dbCollection.find().toArray();

  // Drop the collection in the new database if it exists
  await devDatabase.dropCollection(collectionName).catch(() => {});

  // Create a new collection in the new database
  const newCollection = devDatabase.collection(collectionName);

  // Insert the documents into the new collection
  if (documents.length > 0) {
    await newCollection.insertMany(documents);
  }
}

console.log("Database cloned");

// Get the list of files in the migrations folder
const files = fs.readdirSync("./migrations");

// Order the files by name
files.sort();

const migrationsCollection = devDatabase.collection("migrations");

for (const file of files) {
  // Get the file name without the extension
  const migrationId = file.replace(".ts", "");

  // Check if the migration has already been applied
  const migration = await migrationsCollection.findOne({
    migration_id: migrationId,
  });

  if (migration) {
    console.log(`Migration ${migrationId} has already been applied`);
    continue;
  }

  // Import the migration file
  const { default: migrationFunction } = await import(
    `./migrations/${migrationId}`
  );

  console.log(`Applying migration ${migrationId}`);

  try {
    // Run the migration
    await migrationFunction(uri, devDbName, migrationId);
  } catch (error) {
    console.error(`Error applying migration ${migrationId}: ${error.message}`);
    throw error;
  }

  console.log(`Migration ${migrationId} has been applied`);

  // Insert the migration into the migrations collection
  // await migrationsCollection.insertOne({
  //   migration_id: migrationId,
  //   created_at: new Date(),
  // });
}

await client.close();

process.exit();
