import { z } from "zod";
import { App } from "octokit";
import type { User } from "lucia";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    licenseId: z.string(),
    licenseContent: z.string(),
    customLicenseTitle: z.string().optional(),
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
      statusMessage: "The provided parameters are invalid",
      statusCode: 400,
    });
  }

  const { licenseId, licenseContent, customLicenseTitle } = parsedBody.data;

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

  const licenseRequest = await prisma.licenseRequest.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!licenseRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "License request not found",
    });
  }

  // Check if the user is authorized to access the license request
  await repoWritePermissions(event, owner, repo);

  const app = new App({
    appId: process.env.GH_APP_ID!,
    oauth: {
      clientId: null as unknown as string,
      clientSecret: null as unknown as string,
    },
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
  });

  const octokit = await app.getInstallationOctokit(
    installation.installation_id,
  );

  // Edit the issue body with a hidden request for the release

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
      issue.user?.login !== "codefair-app[bot]"
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

    // Update details to database
    const updatedLicenseRequest = await prisma.licenseRequest.update({
      data: {
        license_id: licenseId,
        license_content: licenseContent,
        custom_license_title: customLicenseTitle,
      },
      where: {
        id: licenseRequest.id,
      },
    });

    if (!updatedLicenseRequest) {
      throw createError({
        statusCode: 500,
        statusMessage: "license-request-update-failed",
      });
    }

    return {
      licenseId,
      licenseContent,
      customLicenseTitle,
    };
  } catch (error: any) {
    console.error("Failed to update issue body", error);

    if (error.message === "Not Found") {
      throw createError({
        statusCode: 404,
        statusMessage: "Issue not found",
      });
    }

    if (error.message === "Validation failed") {
      throw createError({
        statusCode: 400,
        statusMessage: "Issue validation failed",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to update issue body",
    });
  }
});
