import { MongoClient } from "mongodb";
import { z } from "zod";
import { App } from "octokit";
import { nanoid } from "nanoid";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    licenseId: z.string(),
    licenseContent: z.string(),
  });

  const { identifier } = event.context.params as { identifier: string };

  const body = await readBody(event);

  if (!body) {
    throw createError({
      statusCode: 400,
      message: "Missing required fields",
    });
  }

  const parsedBody = bodySchema.safeParse(body);

  if (!parsedBody.success) {
    throw createError({
      message: "The provided parameters are invalid",
      statusCode: 400,
    });
  }

  const { licenseId, licenseContent } = parsedBody.data;

  const client = new MongoClient(process.env.MONGODB_URI as string, {});

  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME);
  const collection = db.collection("licenseRequests");

  const licenseRequest = await collection.findOne({
    identifier,
  });

  if (!licenseRequest) {
    throw createError({
      statusCode: 404,
      message: "License request not found",
    });
  }

  // Check if the user is authorized to access the license request
  await repoWritePermissions(event, licenseRequest.owner, licenseRequest.repo);

  if (!licenseRequest.open) {
    throw createError({
      statusCode: 400,
      message: "License request is not open",
    });
  }

  // Create an octokit app instance
  const app = new App({
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
    oauth: {
      clientId: null as unknown as string,
      clientSecret: null as unknown as string,
    },
  });

  // Get the installation instance for the app
  const octokit = await app.getInstallationOctokit(
    licenseRequest.installationId,
  );

  // Get the default branch of the repository
  const { data: repoData } = await octokit.request(
    "GET /repos/{owner}/{repo}",
    {
      owner: licenseRequest.owner,
      repo: licenseRequest.repo,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  const defaultBranch = repoData.default_branch;
  console.log("📢 [index.post.ts:89]", defaultBranch);

  // Get the default branch reference
  const { data: refData } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/ref/{ref}",
    {
      owner: licenseRequest.owner,
      repo: licenseRequest.repo,
      ref: `heads/${defaultBranch}`,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  // Create a new branch for the license addition
  const newBranchName = `license-${nanoid()}`;
  console.log("📢 [index.post.ts:103]", newBranchName);

  // Create a new branch from the default branch
  await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
    owner: licenseRequest.owner,
    repo: licenseRequest.repo,
    ref: `refs/heads/${newBranchName}`,
    sha: refData.object.sha,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  let existingLicenseSHA = "";

  // Check if the license file already exists
  try {
    const { data: licenseData } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: licenseRequest.owner,
        repo: licenseRequest.repo,
        path: "LICENSE",
        ref: newBranchName,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    existingLicenseSHA = "sha" in licenseData ? licenseData.sha : "";
  } catch (error) {
    // Do nothing
    existingLicenseSHA = "";
  }

  // Create a new file with the license content
  await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner: licenseRequest.owner,
    repo: licenseRequest.repo,
    path: "LICENSE",
    message: `feat: ✨ add LICENSE file with ${licenseId} license terms`,
    content: Buffer.from(licenseContent).toString("base64"),
    branch: newBranchName,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
    ...(existingLicenseSHA && { sha: existingLicenseSHA }),
  });

  // Create a pull request for the new branch with the license content

  /**
   * todo: figure out how to resolve the issue number
   */
  const { data: pullRequestData } = await octokit.request(
    "POST /repos/{owner}/{repo}/pulls",
    {
      owner: licenseRequest.owner,
      repo: licenseRequest.repo,
      title: "feat: ✨ LICENSE file added",
      head: newBranchName,
      base: defaultBranch,
      // body: `Resolves #${context.payload.issue.number}`,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  /**
   * ? Should we close the license request here? Or should we wait for the PR to be merged?
   */

  // const closeLicenseRequest = await collection.updateOne(
  //   {
  //     identifier,
  //   },
  //   {
  //     $set: {
  //       open: false,
  //     },
  //   },
  // );

  // if (!closeLicenseRequest) {
  //   throw createError({
  //     statusCode: 500,
  //     statusMessage: "license-request-not-closed",
  //   });
  // }

  return {
    prUrl: pullRequestData.html_url,
    message: "License request updated successfully",
  };
});
