import { MongoClient } from "mongodb";
import { PrismaClient } from "@prisma/client";

const transferFunction = async () => {
  // Set up Mongo Connection
  const mongodbUri = process.env.MONGODB_URI || "";
  const client = new MongoClient(mongodbUri);

  await client.connect();

  const mongoDatabase = client.db("dev");

  const userCollection = mongoDatabase.collection("users");
  const installationCollection = mongoDatabase.collection("installation");
  const licenseCollection = mongoDatabase.collection("licenseRequests");
  const metadataCollection = mongoDatabase.collection("codeMetadata");
  const cwlCollection = mongoDatabase.collection("cwlValidation");
  const analyticsCollection = mongoDatabase.collection("analytics");

  // Set up Prisma connection
  const prisma = new PrismaClient();

  // Transfer data from MongoDB to Prisma
  const users = await userCollection.find().toArray();
  const installations = await installationCollection.find().toArray();
  const licenseReq = await licenseCollection.find().toArray();
  const metadataReq = await metadataCollection.find().toArray();
  const cwlReq = await cwlCollection.find().toArray();
  const analytics = await analyticsCollection.find().toArray();

  // await prisma.$executeRaw`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "Installation" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "LicenseRequest" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "CodeMetadata" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "CwlValidation" RESTART IDENTITY CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "Analytics" RESTART IDENTITY CASCADE`;

  // Transfer user data
  // for (const user of users) {
  //   await prisma.user.create({
  //     data: {
  //       id: createId(),
  //       username: user.username,
  //       access_token: user.access_token,
  //       github_id: user.github_id,
  //       last_login: new Date(),
  //     },
  //   });
  // }

  // Transfer installation data
  for (const install of installations) {
    await prisma.installation.create({
      data: {
        id: install.repositoryId,
        disabled: install.disabled || false,
        installation_id: install.installationId,
        latest_commit_date: install.latestCommitDate || "",
        latest_commit_message: install.latestCommitMessage || "",
        latest_commit_sha: install.latestCommitSha || "",
        latest_commit_url: install.latestCommitUrl || "",
        owner: install.owner,
        repo: install.repo,
      },
    });
  }

  // Transfer license request data
  for (const license of licenseReq) {
    await prisma.licenseRequest.create({
      data: {
        contains_license: license.contains_license || false,
        identifier: license.identifier,
        license_content: license.licenseContent || "",
        license_id: license.licenseId || "",
        license_status: license.license_status || "invalid",
        pull_request_url: license.pullRequestURL || "",
        repository_id: license.repositoryId,
      },
    });
  }

  // Transfer metadata data
  for (const metadata of metadataReq) {
    await prisma.codeMetadata.create({
      data: {
        citation_status: metadata.citation_status || "",
        codemeta_status: metadata.codemeta_status || "",
        contains_citation: metadata.contains_citation || false,
        contains_codemeta: metadata.contains_metadata || false,
        contains_metadata: metadata.contains_metadata || false,
        identifier: metadata.identifier,
        metadata: metadata.metadata || {},
        pull_request_url: metadata.pullRequestURL || "",
        repository_id: metadata.repositoryId,
      },
    });
  }

  // Transfer CWL Validation data
  for (const cwl of cwlReq) {
    await prisma.cwlValidation.create({
      data: {
        contains_cwl_files: cwl.contains_cwl_files || false,
        files: cwl.files || [],
        identifier: cwl.identifier,
        overall_status: cwl.overall_status || "",
        repository_id: cwl.repositoryId,
      },
    });
  }

  // Transfer analytics data
  for (const entry of analytics) {
    await prisma.analytics.create({
      data: {
        id: entry.repositoryId,
        cwl_rerun_validation: entry?.cwlValidation?.rerunCwlValidation || 0,
        cwl_validated_file_count: entry?.cwlValidation?.validatedFileCount || 0,
        license_created: entry?.license?.createLicense || 0,
        update_citation: entry?.codeMetadata?.updateCitationCFF || 0,
        update_codemeta: entry?.codeMetadata?.updateCodemeta || 0,
      },
    });
  }
};

const main = async () => {
  await transferFunction();
  process.exit(0);
};
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
