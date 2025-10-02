import { z } from "zod";
import { App } from "octokit";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    owner: z.string(),
    repo: z.string(),
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

  const { owner, repo } = parsedBody.data;

  // Get the installation instance for the app
  const installation = await prisma.installation.findFirst({
    where: {
      owner,
      repo,
    },
  });

  if (!installation) {
    throw createError({
      statusCode: 404,
      statusMessage: "installation-not-found",
    });
  }

  // Check if the user is authorized to access the license request
  await repoWritePermissions(event, owner, repo);

  if (!process.env.GH_APP_PRIVATE_KEY) {
    throw new Error("GH_APP_PRIVATE_KEY is not defined.");
  }

  const app = new App({
    appId: process.env.GH_APP_ID!,
    oauth: {
      clientId: null as unknown as string,
      clientSecret: null as unknown as string,
    },
    privateKey: process.env.GH_APP_PRIVATE_KEY.replace(/\\n/g, "\n")!,
  });

  const octokit = await app.getInstallationOctokit(
    installation.installation_id,
  );
  try {
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

    const updatedIssueBody = `${issue.body}<!-- @codefair-bot re-render-dashboard -->`;

    await octokit.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
      body: updatedIssueBody,
      issue_number: installation.issue_number,
      owner,
      repo,
    });
    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Failed to update issue body", error);

    if (error.message === "Not Found") {
      throw createError({
        statusCode: 404,
        statusMessage: "Issue not found",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to update issue body",
    });
  }
});
