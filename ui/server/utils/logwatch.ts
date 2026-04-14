import { consola } from "consola";

type LogLevel = "trace" | "debug" | "info" | "warning" | "error" | "critical";

export interface LogContext {
  action: string;
  installationId?: number;
  message: string;
  owner?: string;
  repo?: string;
  [key: string]: unknown;
}

interface LogPayload {
  level: LogLevel;
  message: string;
  content?: string;
  type: "text" | "json";
}

class Logwatch {
  private readonly endpoint: string;

  constructor(endpoint?: string) {
    this.endpoint = endpoint ?? process.env.UI_LOGWATCH_URL ?? "";
  }

  private _format(message: unknown): string {
    return typeof message === "object"
      ? JSON.stringify(message, null, 2)
      : String(message);
  }

  private _send(level: LogLevel, message: unknown): void {
    if (!this.endpoint) return;

    const isObject = typeof message === "object" && message !== null;
    let payload: LogPayload;

    if (isObject && "message" in (message as object)) {
      payload = {
        level,
        message: (message as LogContext).message,
        content: JSON.stringify(message),
        type: "json",
      };
    } else {
      payload = {
        level,
        message: isObject ? JSON.stringify(message) : String(message),
        type: isObject ? "json" : "text",
      };
    }

    fetch(this.endpoint, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch((err) => consola.error("Logwatch send failed:", err));
  }

  trace(message: unknown): void {
    consola.trace(this._format(message));
    this._send("trace", message);
  }

  debug(message: unknown): void {
    consola.debug(this._format(message));
    this._send("debug", message);
  }

  info(message: unknown): void {
    consola.info(this._format(message));
    this._send("info", message);
  }

  success(message: unknown): void {
    consola.success(this._format(message));
    this._send("info", message);
  }

  warn(message: unknown): void {
    consola.warn(this._format(message));
    this._send("warning", message);
  }

  error(message: unknown): void {
    consola.error(this._format(message));
    this._send("error", message);
  }

  critical(message: unknown): void {
    consola.fatal(this._format(message));
    this._send("critical", message);
  }
}

export const logwatch = new Logwatch();
