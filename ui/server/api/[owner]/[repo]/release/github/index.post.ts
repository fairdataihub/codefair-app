import { z } from "zod";
import { App } from "octokit";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    title: z.string(),
    release: z.literal("new"),
    tag: z.string(),
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

  const { title, tag } = parsedBody.data;

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
    appId: process.env.GH_APP_ID!,
    oauth: {
      clientId: null as unknown as string,
      clientSecret: null as unknown as string,
    },
    privateKey: process.env.GH_APP_PRIVATE_KEY!,
  });

  const octokit = await app.getInstallationOctokit(
    installation.installation_id,
  );

  const { data: releaseData } = await octokit.request(
    "POST /repos/{owner}/{repo}/releases",
    {
      name: title,
      draft: true,
      generate_release_notes: true,
      owner,
      repo,
      tag_name: tag,
    },
  );

  return {
    htmlUrl: releaseData.html_url,
    message: "GitHub release draft created",
    releaseId: releaseData.id,
  };
});
