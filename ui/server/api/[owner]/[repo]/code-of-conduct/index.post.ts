import { z } from "zod";
import { App } from "octokit";
import { nanoid } from "nanoid";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    codeContent: z.string(),
    codeTitle: z.string().optional(),
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

  const { codeContent, codeTitle } = parsedBody.data;

  const code = await prisma.codeofConductValidation.findFirst({
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

  if (!code) {
    throw createError({
      statusCode: 404,
      statusMessage: "Code of conduct request not found",
    });
  }

  if (!code.repository) {
    throw createError({
      statusCode: 404,
      statusMessage: "Installation not found",
    });
  }

  const codePath = code.contains_code ? code.code_path : "CODE_OF_CONDUCT.md";

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
    code.repository.installation_id,
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

  // Create a new branch for the code of conduct addition
  const newBranchName = `code-of-conduct-${nanoid(5)}`;

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

  let existingCodeSHA = "";

  // Check if the code of conduct file already exists
  try {
    const { data: codeData } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
        owner,
        path: codePath,
        ref: newBranchName,
        repo,
      },
    );

    existingCodeSHA = "sha" in codeData ? codeData.sha : "";
  } catch (error) {
    // Do nothing
    existingCodeSHA = "";
  }

  // Create a new file with the license content
  await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    branch: newBranchName,
    content: Buffer.from(codeContent).toString("base64"),
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
    message: `feat: ✨ ${existingCodeSHA ? "Update" : "Create"} CODE_OF_CONDUCT.md file`,
    owner,
    path: codePath,
    repo,
    ...(existingCodeSHA && { sha: existingCodeSHA }),
  });

  // Create a pull request for the new branch with the license content
  const { data: pullRequestData } = await octokit.request(
    "POST /repos/{owner}/{repo}/pulls",
    {
      title: `feat: ✨ CODE_OF_CONDUCT.md file ${existingCodeSHA ? "updated" : "added"}`,
      base: defaultBranch,
      body: `This pull request ${
        existingCodeSHA
          ? `updates the existing ${codePath} file`
          : `adds the ${codePath} file created with Codefair`
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
  const updatedCode = await prisma.codeofConductValidation.update({
    data: {
      code_content: codeContent,
      code_path: codePath,
      code_template_type: codeTitle ?? "Custom",
      pull_request_url: pullRequestData.html_url,
    },
    include: {
      repository: true,
    },
    where: {
      id: code.id,
    },
  });

  if (!updatedCode) {
    throw createError({
      statusCode: 500,
      statusMessage: "code-of-conduct-request-update-failed",
    });
  }

  const existingAnalytics = await prisma.analytics.findFirst({
    where: {
      id: updatedCode.repository_id,
    },
  });

  if (!existingAnalytics) {
    await prisma.analytics.create({
      data: {
        id: updatedCode.repository_id,
        update_code_of_conduct: 1,
      },
    });
  }

  return {
    message: "Code of conduct request updated successfully",
    prUrl: pullRequestData.html_url,
  };
});
