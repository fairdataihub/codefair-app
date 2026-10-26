-- Heartbeat of the running Zenodo publication, so only one runs per repository.
-- AlterTable
ALTER TABLE "ZenodoDeposition" ADD COLUMN     "publish_lock_at" TIMESTAMP(3);
