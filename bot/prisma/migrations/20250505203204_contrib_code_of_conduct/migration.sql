-- CreateTable
CREATE TABLE "CodeofConductValidation" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "contains_code" BOOLEAN NOT NULL DEFAULT false,
    "code_content" TEXT NOT NULL DEFAULT '',
    "code_path" TEXT NOT NULL DEFAULT '',
    "pull_request_url" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeofConductValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributingValidation" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "contains_contrib" BOOLEAN NOT NULL DEFAULT false,
    "contrib_content" TEXT NOT NULL DEFAULT '',
    "contrib_path" TEXT NOT NULL DEFAULT '',
    "pull_request_url" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContributingValidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CodeofConductValidation_identifier_key" ON "CodeofConductValidation"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "CodeofConductValidation_repository_id_key" ON "CodeofConductValidation"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "ContributingValidation_identifier_key" ON "ContributingValidation"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ContributingValidation_repository_id_key" ON "ContributingValidation"("repository_id");

-- AddForeignKey
ALTER TABLE "CodeofConductValidation" ADD CONSTRAINT "CodeofConductValidation_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributingValidation" ADD CONSTRAINT "ContributingValidation_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
