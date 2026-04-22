/**
 * POST /api/[owner]/[repo]/release/zenodo
 *
 * Saves the user's release configuration to the database.
 * When `publish: true`, immediately streams the full Zenodo publication
 * workflow back to the client via Server-Sent Events (SSE).
 *
 * Replaces the previous approach of injecting a hidden HTML comment into
 * the dashboard issue to trigger the bot.
 */
import { z } from "zod";
import type { User } from "lucia";
import { beginZenodoPublication } from "~/server/services/archival/zenodo";
import type { PublicationProgressEvent } from "~/server/services/archival/interface";

const bodySchema = z
  .object({
    metadata: z.object({
      accessRight: z.string(),
      version: z.string(),
    }),
    /** When true, start the publication immediately via SSE. */
    publish: z.boolean(),
    release: z.string(),
    tag: z.string(),
    useExistingDeposition: z.boolean(),
    zenodoDepositionId: z.string(),
  })
  .strict();

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const user = event.context.user as User | null;

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  // Validate body
  const rawBody = await readBody(event);
  if (!rawBody) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing request body",
    });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request parameters",
    });
  }

  const {
    metadata,
    publish,
    release,
    tag,
    useExistingDeposition,
    zenodoDepositionId,
  } = parsed.data;

  // Auth / permission checks
  await repoWritePermissions(event, owner, repo);

  const installation = await prisma.installation.findFirst({
    where: { owner, repo },
  });

  if (!installation) {
    throw createError({
      statusCode: 404,
      statusMessage: "installation-not-found",
    });
  }

  // ── Zenodo token check ───────────────────────────────────────────
  const zenodoTokenInfo = await prisma.zenodoToken.findFirst({
    where: { user_id: user?.id },
  });

  if (!zenodoTokenInfo) {
    throw createError({
      statusCode: 400,
      statusMessage: "Zenodo token not found",
    });
  }

  // Validate GitHub release
  const ghRelease = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/${release}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${user?.access_token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!ghRelease.ok) {
    throw createError({
      statusCode: 500,
      statusMessage: "GitHub release not found",
    });
  }

  const ghReleaseJson = await ghRelease.json();

  if (!ghReleaseJson.draft) {
    throw createError({
      statusCode: 400,
      statusMessage: "GitHub release is not a draft",
    });
  }

  // Check that no published release already claims the tag we're going to use.
  // Use `tag` from the request body (not ghReleaseJson.tag_name) because the
  // user may have selected a new tag that differs from the draft's current tag -
  // the sync step below will update the draft, but we need to validate the
  // intended tag first.
  const tagName = tag;
  const allReleasesRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${user?.access_token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (allReleasesRes.ok) {
    const allReleases: any[] = await allReleasesRes.json();
    const conflict = allReleases.find(
      (r) => !r.draft && r.tag_name === tagName,
    );
    if (conflict) {
      throw createError({
        statusCode: 409,
        statusMessage: `tag-already-released`,
      });
    }
  }

  // Sync tag name if it changed
  if (ghReleaseJson.tag_name !== tag) {
    const patchRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/${release}`,
      {
        body: JSON.stringify({ tag_name: tag }),
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${user?.access_token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        method: "PATCH",
      },
    );

    if (!patchRes.ok) {
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to update GitHub release tag",
      });
    }
  }

  // Persist to DB (draft state)
  const existingDep = await prisma.zenodoDeposition.findFirst({
    where: { repository: { owner, repo } },
  });

  const depositionData = {
    existing_zenodo_deposition_id: useExistingDeposition,
    github_release_id: parseInt(release) || null,
    github_tag_name: tag,
    status: "draft",
    user_id: user?.id ?? "",
    zenodo_id: parseInt(zenodoDepositionId) || null,
    zenodo_metadata: metadata,
  };

  if (existingDep) {
    await prisma.zenodoDeposition.update({
      data: depositionData,
      where: { repository_id: installation.id },
    });
  } else {
    await prisma.zenodoDeposition.create({
      data: { ...depositionData, repository_id: installation.id },
    });
  }

  // Save-only path
  if (!publish) {
    return { message: "Zenodo details saved" };
  }

  // SSE publication path
  setResponseHeaders(event, {
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
  });

  const { res } = event.node;
  let clientConnected = true;

  res.on("close", () => {
    clientConnected = false;
  });

  /**
   * Writes a Server-Sent Event frame to the response stream.
   * @param data - Payload to JSON-serialize and send to the client.
   */
  const sendEvent = (data: Record<string, unknown>) => {
    if (clientConnected && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  /**
   * Forwards a publication progress event to the SSE stream.
   * @param progress - Progress event from the Zenodo publication workflow.
   */
  const onProgress = (progress: PublicationProgressEvent) => {
    sendEvent(progress as unknown as Record<string, unknown>);
  };

  try {
    const result = await beginZenodoPublication(
      {
        depositionId:
          zenodoDepositionId && zenodoDepositionId !== "new"
            ? parseInt(zenodoDepositionId)
            : undefined,
        installationId: installation.installation_id,
        metadata,
        mode: useExistingDeposition ? "existing" : "new",
        owner,
        release,
        repo,
        repositoryId: installation.id,
        tag,
        userAccessToken: user?.access_token ?? "",
        userId: user?.id ?? "",
      },
      onProgress,
    );

    if (!result.success) {
      sendEvent({
        message: result.error ?? "Publication failed",
        status: "error",
        step: "error",
      });
    } else {
      sendEvent({
        data: result.data,
        message: "Successfully published to Zenodo!",
        status: "completed",
        step: "complete",
      });
    }
  } catch (err: any) {
    sendEvent({
      message: err?.message ?? "An unexpected error occurred",
      status: "error",
      step: "error",
    });
  }

  if (!res.writableEnded) {
    res.end();
  }
});
