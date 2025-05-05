import { z } from "zod";
import { App } from "octokit";
import { nanoid } from "nanoid";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    contribContent: z.string(),
  });

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

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
      statusCode: 400,
      statusMessage: "The provided parameters are invalid",
    });
  }

  const { contribContent } = parsedBody.data;

  const contrib = await prisma.contributingValidation.findFirst({
    include: {
      repository: true,
    },
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!contrib) {
    throw createError({
      statusCode: 404,
      statusMessage: "Contributing request not found",
    });
  }

  if (!contrib.repository) {
    throw createError({
      statusCode: 404,
      statusMessage: "Installation not found",
    });
  }

  const contribPath = contrib.contains_contrib
    ? contrib.contrib_path
    : "CONTRIBUTING.md";

  // Check if the user is authorized to access the license request
  await repoWritePermissions(event, owner, repo);

  if (!process.env.GH_APP_PRIVATE_KEY) {
    throw new Error("GH_APP_PRIVATE_KEY is not defined.");
  }

  // Create an octokit app instance
  const app = new App({
    appId: process.env.GH_APP_ID!,
    oauth: {
      clientId: null as unknown as string,
      clientSecret: null as unknown as string,
    },
    privateKey: process.env.GH_APP_PRIVATE_KEY.replace(/\\n/g, "\n")!,
  });

  // Get the installation instance for the app
  const octokit = await app.getInstallationOctokit(
    contrib.repository.installation_id,
  );

  // Get the default branch of the repository
  const { data: repoData } = await octokit.request(
    "GET /repos/{owner}/{repo}",
    {
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
      owner,
      repo,
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
      owner,
      ref: `heads/${defaultBranch}`,
      repo,
    },
  );

  // Create a new branch for the contrib addition
  const newBranchName = `contributing-${nanoid(5)}`;

  // Create a new branch from the default branch
  await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
    owner,
    ref: `refs/heads/${newBranchName}`,
    repo,
    sha: refData.object.sha,
  });

  let existingContribSHA = "";

  // Check if the license file already exists
  try {
    const { data: contribData } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
        owner,
        path: contribPath,
        ref: newBranchName,
        repo,
      },
    );

    existingContribSHA = "sha" in contribData ? contribData.sha : "";
  } catch (error) {
    // Do nothing
    existingContribSHA = "";
  }

  // Create a new file with the license content
  await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    branch: newBranchName,
    content: Buffer.from(contribContent).toString("base64"),
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
    message: `feat: ✨ ${existingContribSHA ? "Update" : "Create"} CONTRIBUTING.md file`,
    owner,
    path: contribPath,
    repo,
    ...(existingContribSHA && { sha: existingContribSHA }),
  });

  // Create a pull request for the new branch with the license content
  const { data: pullRequestData } = await octokit.request(
    "POST /repos/{owner}/{repo}/pulls",
    {
      title: `feat: ✨ ${contribPath} file ${existingContribSHA ? "updated" : "added"}`,
      base: defaultBranch,
      body: `This pull request ${
        existingContribSHA
          ? "updates the existing CONTRIBUTING.md file"
          : `adds the ${contribPath} file created with Codefair`
      }. Please review the changes and merge the pull request if everything looks good.`,
      head: newBranchName,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
      owner,
      repo,
    },
  );

  // Save the PR URL to the database
  // Update the license content and the license id in the database
  const updatedContrib = await prisma.contributingValidation.update({
    data: {
      contrib_content: contribContent,
      contrib_path: contribPath,
      pull_request_url: pullRequestData.html_url,
    },
    include: {
      repository: true,
    },
    where: {
      id: contrib.id,
    },
  });

  if (!updatedContrib) {
    throw createError({
      statusCode: 500,
      statusMessage: "contributing-request-update-failed",
    });
  }

  const existingAnalytics = await prisma.analytics.findFirst({
    where: {
      id: updatedContrib.repository.id,
    },
  });

  if (!existingAnalytics) {
    await prisma.analytics.create({
      data: {
        id: updatedContrib.repository.id,
        update_readme: 1,
      },
    });
  }

  return {
    message: "CONTRIBUTING.md request updated successfully",
    prUrl: pullRequestData.html_url,
  };
});
