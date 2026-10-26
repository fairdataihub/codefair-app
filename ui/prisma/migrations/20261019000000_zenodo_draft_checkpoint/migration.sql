-- Track an in-progress publication's Zenodo draft, and the record it versions,
-- separately from zenodo_id (the last published record).
-- AlterTable
ALTER TABLE "ZenodoDeposition" ADD COLUMN     "draft_target_zenodo_id" INTEGER,
ADD COLUMN     "draft_zenodo_id" INTEGER;
