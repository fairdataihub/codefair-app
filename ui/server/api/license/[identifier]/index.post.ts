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
      statusMessage: "Missing required fields",
    });
  }

  const parsedBody = bodySchema.safeParse(body);

  if (!parsedBody.success) {
    throw createError({
      statusMessage: "The provided parameters are invalid",
      statusCode: 400,
    });
  }

  const { licenseId, licenseContent } = parsedBody.data;

  const licenseRequest = await prisma.licenseRequest.findFirst({
    where: {
      identifier,
    },
    include: {
      repository: true,
    },
  });

  if (!licenseRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "License request not found",
    });
  }

  if (!licenseRequest.repository) {
    throw createError({
      statusCode: 404,
      statusMessage: "Installation not found",
    });
  }

  // Check if the user is authorized to access the license request
  await repoWritePermissions(
    event,
    licenseRequest.repository.owner,
    licenseRequest.repository.repo,
  );

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
    licenseRequest.repository.installation_id,
  );

  // Get the default branch of the repository
  const { data: repoData } = await octokit.request(
    "GET /repos/{owner}/{repo}",
    {
      owner: licenseRequest.repository.owner,
      repo: licenseRequest.repository.repo,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  const defaultBranch = repoData.default_branch;

  // Get the default branch reference
  const { data: refData } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/ref/{ref}",
    {
      owner: licenseRequest.repository.owner,
      repo: licenseRequest.repository.repo,
      ref: `heads/${defaultBranch}`,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  // Create a new branch for the license addition
  const newBranchName = `license-${nanoid()}`;

  // Create a new branch from the default branch
  await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
    owner: licenseRequest.repository.owner,
    repo: licenseRequest.repository.repo,
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
        owner: licenseRequest.repository.owner,
        repo: licenseRequest.repository.repo,
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
    owner: licenseRequest.repository.owner,
    repo: licenseRequest.repository.repo,
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
  const { data: pullRequestData } = await octokit.request(
    "POST /repos/{owner}/{repo}/pulls",
    {
      owner: licenseRequest.repository.owner,
      repo: licenseRequest.repository.repo,
      title: "feat: ✨ LICENSE file added",
      head: newBranchName,
      base: defaultBranch,
      body: `This pull request ${
        existingLicenseSHA
          ? "updates the existing LICENSE file"
          : `adds the LICENSE file with the ${licenseId} license terms`
      }. Please review the changes and merge the pull request if everything looks good.`,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  // Save the PR URL to the database
  // Update the license content and the license id in the database
  const updatedLicenseRequest = await prisma.licenseRequest.update({
    data: {
      license_content: licenseContent,
      license_id: licenseId,
      pull_request_url: pullRequestData.html_url,
    },
    where: {
      identifier,
    },
  });

  if (!updatedLicenseRequest) {
    throw createError({
      statusCode: 500,
      statusMessage: "license-request-update-failed",
    });
  }

  const existingAnalytics = await prisma.analytics.findFirst({
    where: {
      id: licenseRequest.repository.id,
    },
  });

  if (!existingAnalytics) {
    await prisma.analytics.create({
      data: {
        id: licenseRequest.repository.id,
        license_created: 1,
      },
    });
  }

  if (existingAnalytics?.license_created) {
    await prisma.analytics.update({
      data: {
        license_created: existingAnalytics.license_created + 1,
      },
      where: {
        id: existingAnalytics.id,
      },
    });
  }

  return {
    prUrl: pullRequestData.html_url,
    message: "License request updated successfully",
  };
});
