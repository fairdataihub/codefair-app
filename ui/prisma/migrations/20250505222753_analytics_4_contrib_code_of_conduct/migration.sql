-- AlterTable
ALTER TABLE "Analytics" ADD COLUMN     "update_code_of_conduct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "update_contributing" INTEGER NOT NULL DEFAULT 0;
