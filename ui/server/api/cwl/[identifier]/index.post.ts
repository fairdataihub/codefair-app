import { MongoClient } from "mongodb";
import { z } from "zod";
import { App } from "octokit";
import { nanoid } from "nanoid";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    licenseContent: z.string(),
    licenseId: z.string(),
  });

  const { identifier } = event.context.params as { identifier: string };

  const body = await readBody(event);

  if (!body) {
    throw createError({
      message: "Missing required fields",
      statusCode: 400,
    });
  }

  const parsedBody = bodySchema.safeParse(body);

  if (!parsedBody.success) {
    throw createError({
      message: "The provided parameters are invalid",
      statusCode: 400,
    });
  }

  const { licenseContent, licenseId } = parsedBody.data;

  const client = new MongoClient(process.env.MONGODB_URI as string, {});

  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME);
  const collection = db.collection("cwlValidation");
  const installation = db.collection("installation");

  const licenseRequest = await collection.findOne({
    identifier,
  });

  if (!licenseRequest) {
    throw createError({
      message: "Cwl request not found",
      statusCode: 404,
    });
  }

  const installationId = await installation.findOne({
    repositoryId: licenseRequest.repositoryId,
  });

  if (!installationId) {
    throw createError({
      message: "Installation not found",
      statusCode: 404,
    });
  }

  // Check if the user is authorized to access the license request
  await repoWritePermissions(event, licenseRequest.owner, licenseRequest.repo);

  if (!licenseRequest.open) {
    throw createError({
      message: "Cwl request is not open",
      statusCode: 400,
    });
  }

  // Create an octokit app instance
  const app = new App({
    appId: process.env.GITHUB_APP_ID!,
    oauth: {
      clientId: null as unknown as string,
      clientSecret: null as unknown as string,
    },
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
  });

  // Get the installation instance for the app
  const octokit = await app.getInstallationOctokit(
    installationId.installationId,
  );

  // Get the default branch of the repository
  const { data: repoData } = await octokit.request(
    "GET /repos/{owner}/{repo}",
    {
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
      owner: licenseRequest.owner,
      repo: licenseRequest.repo,
    },
  );

  const defaultBranch = repoData.default_branch;

  // Get the default branch reference
  const { data: refData } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/ref/{ref}",
    {
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
      owner: licenseRequest.owner,
      ref: `heads/${defaultBranch}`,
      repo: licenseRequest.repo,
    },
  );

  // Create a new branch for the license addition
  const newBranchName = `license-${nanoid()}`;

  // Create a new branch from the default branch
  await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
    owner: licenseRequest.owner,
    ref: `refs/heads/${newBranchName}`,
    repo: licenseRequest.repo,
    sha: refData.object.sha,
  });

  let existingLicenseSHA = "";

  // Check if the license file already exists
  try {
    const { data: licenseData } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
        owner: licenseRequest.owner,
        path: "LICENSE",
        ref: newBranchName,
        repo: licenseRequest.repo,
      },
    );

    existingLicenseSHA = "sha" in licenseData ? licenseData.sha : "";
  } catch (error) {
    // Do nothing
    existingLicenseSHA = "";
  }

  // Create a new file with the license content
  await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    branch: newBranchName,
    content: Buffer.from(licenseContent).toString("base64"),
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
    message: `feat: ✨ add LICENSE file with ${licenseId} license terms`,
    owner: licenseRequest.owner,
    path: "LICENSE",
    repo: licenseRequest.repo,
    ...(existingLicenseSHA && { sha: existingLicenseSHA }),
  });

  // Create a pull request for the new branch with the license content

  /**
   * todo: figure out how to resolve the issue number
   */
  const { data: pullRequestData } = await octokit.request(
    "POST /repos/{owner}/{repo}/pulls",
    {
      title: "feat: ✨ LICENSE file added",
      base: defaultBranch,
      head: newBranchName,
      // body: `Resolves #${context.payload.issue.number}`,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
      owner: licenseRequest.owner,
      repo: licenseRequest.repo,
    },
  );

  // Save the PR URL to the database
  // Update the license content and the license id in the database
  await collection.updateOne(
    {
      identifier,
    },
    {
      $set: {
        licenseContent,
        licenseId,
        pullRequestURL: pullRequestData.html_url,
      },
    },
  );

  return {
    message: "License request updated successfully",
    prUrl: pullRequestData.html_url,
  };
});
