type ClientLogLevel = "info" | "warn" | "error";

/**
 * Serializes an arbitrary caught value into something logwatch can store.
 * Errors lose their message/stack under `JSON.stringify`, so pull those out.
 * @param error - The caught value to serialize.
 * @returns A string representation of the error.
 */
function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Forwards a client-side log entry to logwatch via the `/api/log` server bridge
 * (the logwatch endpoint is a server secret, so the browser cannot post to it
 * directly). Pair it with a plain `console.*` call at the call site for local
 * visibility.
 *
 * Forwarding is fire-and-forget: a failed send is swallowed so logging can
 * never surface an error to the user or break the calling flow.
 *
 * Call it during setup (or at the top of a route middleware), not inside a
 * callback, so it can read the request headers and router.
 */
export const useLogwatch = () => {
  // During SSR the internal request to /api/log needs the user's cookie to
  // pass its auth check; in the browser this is empty and cookies go as usual
  const headers = useRequestHeaders(["cookie"]);
  const router = useRouter();

  const send = (
    level: ClientLogLevel,
    action: string,
    message: string,
    context?: Record<string, unknown>,
  ) => {
    const normalized = context?.error
      ? { ...context, error: serializeError(context.error) }
      : context;

    $fetch("/api/log", {
      body: {
        action,
        context: { path: router.currentRoute.value.fullPath, ...normalized },
        level,
        message,
      },
      headers,
      method: "POST",
    }).catch(() => {
      // Never let a logging failure surface to the user.
    });
  };

  return {
    error: (
      action: string,
      message: string,
      context?: Record<string, unknown>,
    ) => send("error", action, message, context),
    info: (
      action: string,
      message: string,
      context?: Record<string, unknown>,
    ) => send("info", action, message, context),
    warn: (
      action: string,
      message: string,
      context?: Record<string, unknown>,
    ) => send("warn", action, message, context),
  };
};
