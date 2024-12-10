-- AlterTable
ALTER TABLE "CodeMetadata" ADD COLUMN     "citation_validation_message" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "codemeta_validation_message" TEXT NOT NULL DEFAULT '';
