/*
  Warnings:

  - You are about to drop the column `testing` on the `Analytics` table. All the data in the column will be lost.
  - You are about to drop the column `hello_world` on the `CwlValidation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Analytics" DROP COLUMN "testing";

-- AlterTable
ALTER TABLE "CwlValidation" DROP COLUMN "hello_world";

-- CreateTable
CREATE TABLE "ZenodoToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "ZenodoToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZenodoDeposition" (
    "id" TEXT NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "existing_zenodo_deposition_id" BOOLEAN,
    "zenodo_id" INTEGER,
    "zenodo_metadata" JSONB NOT NULL DEFAULT '{}',
    "github_release_id" INTEGER,
    "github_tag_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unpublished',
    "user_id" TEXT NOT NULL,

    CONSTRAINT "ZenodoDeposition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZenodoToken_user_id_key" ON "ZenodoToken"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ZenodoDeposition_repository_id_key" ON "ZenodoDeposition"("repository_id");

-- AddForeignKey
ALTER TABLE "ZenodoToken" ADD CONSTRAINT "ZenodoToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZenodoDeposition" ADD CONSTRAINT "ZenodoDeposition_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZenodoDeposition" ADD CONSTRAINT "ZenodoDeposition_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
