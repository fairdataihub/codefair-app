/**
 * POST /api/zenodo/login
 *
 * Starts a Zenodo OAuth sign-in for the signed-in user and returns the Zenodo
 * authorization URL to send the browser to.
 *
 * The OAuth state is signed for the signed-in user, so /api/zenodo/callback
 * only accepts it while that same user is signed in. The state carries no user
 * ID: the callback stores the token for whoever is signed in.
 */
import type { User } from "lucia";
import { z } from "zod";
import { ZenodoProvider } from "~/server/services/archival/zenodo";
import { assertNotInMaintenance } from "~/server/utils/maintenance";
import { signZenodoOAuthState } from "~/server/utils/zenodoOAuthState";

// GitHub owner and repository names. They end up in the redirect path after
// sign-in, so nothing else is allowed.
const githubName = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[\w.-]+$/);

const bodySchema = z
  .object({
    githubRelease: z.string().max(100).default(""),
    githubTag: z.string().max(255).default(""),
    owner: githubName,
    repo: githubName,
  })
  .strict();

export default defineEventHandler(async (event) => {
  protectRoute(event);

  // Also covers Zenodo being off, which pauses both ways of connecting
  await assertNotInMaintenance("zenodoOAuth");

  const parsed = bodySchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request parameters",
    });
  }

  const { githubRelease, githubTag, owner, repo } = parsed.data;

  await repoWritePermissions(event, owner, repo);

  const user = event.context.user as User;
  const state = signZenodoOAuthState(user.id, {
    githubDetails: { githubRelease, githubTag },
    owner,
    repo,
  });

  return { url: new ZenodoProvider().getLoginUrl(state) };
});
