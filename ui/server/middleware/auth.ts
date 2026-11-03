import { verifyRequestOrigin } from "lucia";
import type { User, Session } from "lucia";
import type { H3Event } from "h3";

export default defineEventHandler(async (event) => {
  if (event.node.req.method !== "GET") {
    // Webhook endpoint uses its own HMAC signature verification — skip CSRF check
    if (!event.path.startsWith("/api/webhooks/")) {
      const originHeader = getHeader(event, "Origin") ?? null;
      const hostHeader = getHeader(event, "Host") ?? null;

      if (
        !originHeader ||
        !hostHeader ||
        !verifyRequestOrigin(originHeader, [hostHeader])
      ) {
        return event.node.res.writeHead(403).end();
      }
    }
  }

  const sessionId = getCookie(event, lucia.sessionCookieName) ?? null;

  if (!sessionId) {
    event.context.session = null;
    event.context.user = null;
    assertAdminApiAccess(event);
    return;
  }

  const { session, user } = await lucia.validateSession(sessionId);

  if (session && session.fresh) {
    appendHeader(
      event,
      "Set-Cookie",
      lucia.createSessionCookie(session.id).serialize(),
    );
  }

  if (!session) {
    appendHeader(
      event,
      "Set-Cookie",
      lucia.createBlankSessionCookie().serialize(),
    );
  }

  event.context.session = session;
  event.context.user = user;
  assertAdminApiAccess(event);
});

/**
 * Central gate for every /api/admin route, so a route added later without its
 * own requireAdmin check is still only reachable by admins. Runs here rather
 * than in its own middleware because Nitro runs middleware in file name order
 * and the user has to be resolved first.
 * @param event - The incoming request event, with the session already resolved.
 */
function assertAdminApiAccess(event: H3Event) {
  if (!isAdminApiPath(event.path)) return;

  if (!event.context.user || !event.context.session) {
    throw createError({
      statusCode: 401,
      statusMessage: "not-signed-in",
    });
  }

  if (event.context.user.role !== "admin") {
    throw createError({
      statusCode: 403,
      statusMessage: "admin-only",
    });
  }
}

/**
 * Matches /api/admin and anything below it. The path is decoded, lowercased
 * and has repeated slashes collapsed first, so an encoded or oddly cased
 * variant of an admin route cannot slip past the gate.
 * @param rawPath - The request path, including any query string.
 * @returns True when the request targets an admin API route.
 */
function isAdminApiPath(rawPath: string) {
  let path = rawPath.split("?")[0] ?? "";

  try {
    path = decodeURIComponent(path);
  } catch {
    // Malformed encoding: check the raw path instead
  }

  path = path.replace(/\/{2,}/g, "/").toLowerCase();

  return path === "/api/admin" || path.startsWith("/api/admin/");
}

declare module "h3" {
  interface H3EventContext {
    session: Session | null;
    user: User | null;
  }
}
