const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Define migration folder paths
const migrationsFolder = path.join(__dirname, "prisma", "migrations");
const initMigrationFolder = path.join(migrationsFolder, "0_init");

// Function to run shell commands
function runCommand(command: string): void {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    process.exit(1);
  }
}

// Step 1: Check and create baseline migration folder
if (fs.existsSync(migrationsFolder)) {
  console.log("Migrations folder exists. Archiving or deleting it.");
  // You can archive it, rename, or delete it
  // fs.renameSync(migrationsFolder, `${migrationsFolder}_backup_${Date.now()}`);
  fs.rmSync(migrationsFolder, { recursive: true, force: true });
}

console.log("Creating baseline migration folder...");
fs.mkdirSync(initMigrationFolder, { recursive: true });

// Step 2: Generate baseline migration with prisma migrate diff
const diffCommand: string = `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > ${path.join(initMigrationFolder, "migration.sql")}`;
runCommand(diffCommand);

// Step 3: Mark baseline migration as applied
const resolveCommand: string = `npx prisma migrate resolve --applied 0_init`;
runCommand(resolveCommand);

console.log("Baseline migration created and marked as applied.");

// Step 4: Now you can run migrations programmatically (optional)
const deployMigrationsCommand: string = `npx prisma migrate deploy`;
runCommand(deployMigrationsCommand);

console.log("Migrations deployed.");
