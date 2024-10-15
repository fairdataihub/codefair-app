-- AlterTable
ALTER TABLE "Analytics" ADD COLUMN     "create_release" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "zenodo_release" INTEGER NOT NULL DEFAULT 0;
