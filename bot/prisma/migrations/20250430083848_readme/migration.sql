-- CreateTable
CREATE TABLE "ReadmeValidation" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "contains_readme" BOOLEAN NOT NULL DEFAULT false,
    "readme_content" TEXT NOT NULL DEFAULT '',
    "pull_request_url" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadmeValidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReadmeValidation_identifier_key" ON "ReadmeValidation"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ReadmeValidation_repository_id_key" ON "ReadmeValidation"("repository_id");

-- AddForeignKey
ALTER TABLE "ReadmeValidation" ADD CONSTRAINT "ReadmeValidation_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
