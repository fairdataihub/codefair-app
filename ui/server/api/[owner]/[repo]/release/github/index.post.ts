import { z } from "zod";
import { App } from "octokit";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    tag: z.string(),
    release: z.literal("new"),
    title: z.string(),
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

  const { tag, title } = parsedBody.data;

  // Check if the user has write permissions to the repository
  await repoWritePermissions(event, owner, repo);

  // Get the installation instance for the app
  const installation = await prisma.installation.findFirst({
    where: {
      owner,
      repo,
    },
  });

  if (!installation?.installation_id) {
    throw createError({
      statusCode: 404,
      statusMessage: "installation-not-found",
    });
  }

  const app = new App({
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
    oauth: {
      clientId: null as unknown as string,
      clientSecret: null as unknown as string,
    },
  });

  const octokit = await app.getInstallationOctokit(
    installation.installation_id,
  );

  // Create a release draft
  const { data: releaseData } = await octokit.request(
    "POST /repos/{owner}/{repo}/releases",
    {
      owner,
      repo,
      tag_name: tag,
      name: title,
      generate_release_notes: true,
      draft: true,
    },
  );

  return {
    message: "GitHub release draft created",
    releaseId: releaseData.id,
    htmlUrl: releaseData.html_url,
  };
});
