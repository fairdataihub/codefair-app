-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "access_token" TEXT NOT NULL DEFAULT '',
    "github_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installation" (
    "id" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "installation_id" INTEGER NOT NULL,
    "latest_commit_date" TEXT NOT NULL DEFAULT '',
    "latest_commit_message" TEXT NOT NULL DEFAULT '',
    "latest_commit_sha" TEXT NOT NULL DEFAULT '',
    "latest_commit_url" TEXT NOT NULL DEFAULT '',
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "issue_number" INTEGER NOT NULL DEFAULT 0,
    "owner_is_organization" BOOLEAN NOT NULL DEFAULT false,
    "action_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Installation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseRequest" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "contains_license" BOOLEAN NOT NULL DEFAULT false,
    "license_status" TEXT NOT NULL DEFAULT '',
    "license_id" TEXT,
    "license_content" TEXT NOT NULL DEFAULT '',
    "pull_request_url" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ping" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeMetadata" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "codemeta_status" TEXT NOT NULL DEFAULT '',
    "contains_codemeta" BOOLEAN NOT NULL DEFAULT false,
    "citation_status" TEXT NOT NULL DEFAULT '',
    "contains_citation" BOOLEAN NOT NULL DEFAULT false,
    "contains_metadata" BOOLEAN NOT NULL DEFAULT false,
    "pull_request_url" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CwlValidation" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "hello_world" BOOLEAN NOT NULL DEFAULT false,
    "contains_cwl_files" BOOLEAN NOT NULL DEFAULT false,
    "overall_status" TEXT NOT NULL DEFAULT '',
    "files" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CwlValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analytics" (
    "id" INTEGER NOT NULL,
    "testing" INTEGER NOT NULL DEFAULT 0,
    "cwl_validated_file_count" INTEGER NOT NULL DEFAULT 0,
    "cwl_rerun_validation" INTEGER NOT NULL DEFAULT 0,
    "license_created" INTEGER NOT NULL DEFAULT 0,
    "update_codemeta" INTEGER NOT NULL DEFAULT 0,
    "update_citation" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_github_id_key" ON "User"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseRequest_identifier_key" ON "LicenseRequest"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseRequest_repository_id_key" ON "LicenseRequest"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "CodeMetadata_identifier_key" ON "CodeMetadata"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "CodeMetadata_repository_id_key" ON "CodeMetadata"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "CwlValidation_identifier_key" ON "CwlValidation"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "CwlValidation_repository_id_key" ON "CwlValidation"("repository_id");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseRequest" ADD CONSTRAINT "LicenseRequest_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeMetadata" ADD CONSTRAINT "CodeMetadata_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CwlValidation" ADD CONSTRAINT "CwlValidation_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

