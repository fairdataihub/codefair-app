-- Complete the migration from the legacy Probot service to the central API.
UPDATE "Installation" SET "use_central_api" = true WHERE "use_central_api" = false;

ALTER TABLE "Installation" ALTER COLUMN "use_central_api" SET DEFAULT true;
