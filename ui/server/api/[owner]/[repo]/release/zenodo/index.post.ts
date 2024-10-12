import { z } from "zod";
import { App } from "octokit";
import type { User } from "lucia";

export default defineEventHandler(async (event) => {
  const ZENODO_API_ENDPOINT = process.env.ZENODO_API_ENDPOINT || "";

  protectRoute(event);

  const user = event.context.user as User | null;

  const bodySchema = z
    .object({
      metadata: z.object({
        accessRight: z.string(),
        version: z.string(),
      }),
      publish: z.boolean(),
      release: z.string(),
      tag: z.string(),
      useExistingDeposition: z.boolean(),
      zenodoDepositionId: z.string(),
    })
    .strict();

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
    console.error(parsedBody.error.issues);

    throw createError({
      statusCode: 400,
      statusMessage: "The provided parameters are invalid",
    });
  }

  const {
    metadata,
    publish,
    release,
    tag,
    useExistingDeposition,
    zenodoDepositionId,
  } = parsedBody.data;

  // Check if the user has write permissions to the repository
  await repoWritePermissions(event, owner, repo);

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

  const app = new App({
    appId: process.env.GITHUB_APP_ID!,
    oauth: {
      clientId: null as unknown as string,
      clientSecret: null as unknown as string,
    },
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
  });

  const octokit = await app.getInstallationOctokit(
    installation.installation_id,
  );

  // TODO: Check if the license, codemeta and citation files are present and valid

  // Check if the zenodotoken is valid
  const zenodoTokenInfo = await prisma.zenodoToken.findFirst({
    where: {
      user_id: user?.id,
    },
  });

  if (!zenodoTokenInfo) {
    throw createError({
      statusCode: 400,
      statusMessage: "Zenodo token not found",
    });
  }

  // Get the zenodo deposition
  const zenodoTokenInfoResponse = await fetch(
    `${ZENODO_API_ENDPOINT}/deposit/depositions?access_token=${zenodoTokenInfo.token}`,
    {
      method: "GET",
    },
  );

  if (!zenodoTokenInfoResponse.ok) {
    throw createError({
      statusCode: 500,
      statusMessage: "Zenodo token might be invalid",
    });
  }

  if (zenodoDepositionId) {
    // Check if the zenodo deposition exists
    const zenodoDeposition = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions/${zenodoDepositionId}?access_token=${zenodoTokenInfo.token}`,
      {
        method: "GET",
      },
    );

    if (!zenodoDeposition.ok) {
      throw createError({
        statusCode: 500,
        statusMessage: "Zenodo deposition not found",
      });
    }
  }

  // Check if the github release exists and is a draft
  const githubRelease = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/${release}`,
    {
      headers: {
        Authorization: `Bearer ${user?.access_token}`,
      },
      method: "GET",
    },
  );

  if (!githubRelease.ok) {
    throw createError({
      statusCode: 500,
      statusMessage: "GitHub release not found",
    });
  }

  const githubReleaseJson = await githubRelease.json();

  if (!githubReleaseJson.draft) {
    throw createError({
      statusCode: 500,
      statusMessage: "GitHub release is not a draft",
    });
  }

  // Check if the tag_Name is the same as the last selected tag
  const githubReleaseTagName = githubReleaseJson.tag_name;

  if (githubReleaseTagName !== tag) {
    // Try and update the tag
    const updatedGithubRelease = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/${release}`,
      {
        body: JSON.stringify({
          tag_name: tag,
        }),
        headers: {
          Authorization: `Bearer ${user?.access_token}`,
        },
        method: "PATCH",
      },
    );

    if (!updatedGithubRelease.ok) {
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to update GitHub release tag",
      });
    }
  }

  // save to the database
  const zenodoDeposition = await prisma.zenodoDeposition.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!zenodoDeposition) {
    await prisma.zenodoDeposition.create({
      data: {
        existing_zenodo_deposition_id: useExistingDeposition,
        github_release_id: parseInt(release) || null,
        github_tag_name: tag,
        repository_id: installation.id,
        status: "draft",
        user_id: user?.id || "",
        zenodo_id: parseInt(zenodoDepositionId) || null,
        zenodo_metadata: metadata,
      },
    });
  } else {
    await prisma.zenodoDeposition.update({
      data: {
        existing_zenodo_deposition_id: useExistingDeposition,
        github_release_id: parseInt(release) || null,
        github_tag_name: tag,
        status: "draft",
        user_id: user?.id || "",
        zenodo_id: parseInt(zenodoDepositionId) || null,
        zenodo_metadata: metadata,
      },
      where: {
        repository_id: installation.id,
      },
    });
  }

  if (publish) {
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

      const updatedIssueBody = `${issue.body}<!-- @codefair-bot publish-zenodo ${zenodoDepositionId || "new"} ${release} ${tag} ${user?.username} -->`;

      await octokit.request(
        "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
        {
          body: updatedIssueBody,
          issue_number: installation.issue_number,
          owner,
          repo,
        },
      );

      await prisma.zenodoDeposition.update({
        data: {
          status: "inProgress",
        },
        where: {
          repository_id: installation.id,
        },
      });

      return {
        message: "Zenodo publish process started",
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
  } else {
    return {
      message: "Zenodo details saved",
    };
  }
});
