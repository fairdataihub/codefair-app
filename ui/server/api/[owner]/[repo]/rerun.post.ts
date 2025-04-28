import { App } from "octokit";
import { z } from "zod";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    rerunType: z.string(),
  });

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

  const { rerunType } = parsedBody.data;

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  // Check if the installation exists in the database
  const installation = await prisma.installation.findFirst({
    where: {
      owner,
      repo,
    },
  });

  if (!installation) {
    throw createError({
      statusCode: 404,
      statusMessage: "Installation not found",
    });
  }

  // Check if the issue_number is present in the installation
  if (!installation.issue_number) {
    throw createError({
      statusCode: 404,
      statusMessage: "Issue Dashboard not found",
    });
  }

  // Check if the user is authorized to access the repo to request the validation
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
    installation.installation_id,
  );

  // Edit the issue body with a hidden request for the validation
  try {
    // Get the issue body and add a hidden comment to trigger the validation
    const { data: issue } = await octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}",
      {
        issue_number: installation.issue_number,
        owner,
        repo,
      },
    );

    // Check if the issue was opened by the bot
    if (
      issue.user?.login !== "codefair-test[bot]" &&
      issue.user?.login !== "codefair-staging[bot]" &&
      issue.user?.login !== "codefair-io[bot]"
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: "Potentially not the dashboard issue",
      });
    }

    // Check if the issue body already contains the hidden comment
    const issueBody = issue.body || "";

    if (
      issueBody.includes(`<!-- @codefair-bot rerun-${rerunType}-validation -->`)
    ) {
      throw new Error("Validation already requested");
    }

    const updatedIssueBody = `${issueBody}\n<!-- @codefair-bot rerun-${rerunType}-validation -->`;

    await octokit.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
      body: updatedIssueBody,
      issue_number: installation.issue_number,
      owner,
      repo,
    });
  } catch (error: any) {
    console.error("Failed to update issue body", error);

    if (error.message === "Validation already requested") {
      throw createError({
        statusCode: 400,
        statusMessage: "Validation already requested",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to update issue body",
    });
  }

  return {
    message: "Codefair validation requested",
  };
});
