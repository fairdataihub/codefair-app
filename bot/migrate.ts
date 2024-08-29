import fs from "fs";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { consola } from "consola";

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

// Create a new MongoClient
const client = new MongoClient(uri);

await client.connect();

const database = client.db(dbName);

if (!database) {
  throw new Error("Database not found");
}

// Get the list of files in the migrations folder
const files = fs.readdirSync("./migrations");

// Order the files by name
files.sort();

const migrationsCollection = database.collection("migrations");

for (const file of files) {
  // Get the file name without the extension
  const migrationId = file.replace(".ts", "");

  // Check if the migration has already been applied
  const migration = await migrationsCollection.findOne({
    migration_id: migrationId,
  });

  if (migration) {
    consola.warn(`Migration ${migrationId} has already been applied`);
    continue;
  }

  // Import the migration file
  const { default: migrationFunction } = await import(
    `./migrations/${migrationId}`
  );

  consola.start(`Applying migration ${migrationId}`);

  try {
    // Run the migration
    const entriesUpdated = await migrationFunction(uri, dbName, migrationId);

    consola.success(`Migration ${migrationId} has been applied!`);

    // Insert the migration into the migrations collection
    await migrationsCollection.insertOne({
      created_at: new Date(),
      entries_updated: entriesUpdated,
      migration_id: migrationId,
    });
  } catch (error) {
    consola.error(`Error applying migration ${migrationId}: ${error.message}`);
    throw error;
  }
}

await client.close();

process.exit();
