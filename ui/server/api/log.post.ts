/**
 * POST /api/log
 *
 * Bridge that lets authenticated client-side code forward a log entry to
 * logwatch. The logwatch endpoint (`UI_LOGWATCH_URL`) is a server-side secret,
 * so the browser cannot post to it directly - it goes through here instead.
 */
import { z } from "zod";
import { logwatch } from "~/server/utils/logwatch";

const bodySchema = z
  .object({
    action: z.string().min(1),
    context: z.record(z.unknown()).optional(),
    level: z
      .enum(["trace", "debug", "info", "warn", "error", "critical"])
      .default("error"),
    message: z.string(),
  })
  .strict();

export default defineEventHandler(async (event) => {
  // Gate behind auth so this can't be used as an open log-injection endpoint.
  protectRoute(event);

  const parsed = bodySchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid log payload",
    });
  }

  const { action, context, level, message } = parsed.data;

  // Server-authoritative fields win over anything in `context`.
  logwatch[level]({
    ...context,
    action,
    message,
    source: "client",
    user: event.context.user?.username,
  });

  return { ok: true };
});
