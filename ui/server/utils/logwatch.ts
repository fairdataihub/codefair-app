import { consola } from "consola";

type LogLevel = "trace" | "debug" | "info" | "warning" | "error" | "critical";
type MessageType = "text" | "json";

interface LogPayload {
  level: LogLevel;
  message: string;
  type: MessageType;
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

  private _send(level: LogLevel, message: unknown, asJson = false): void {
    if (!this.endpoint) return;

    const payload: LogPayload = {
      level,
      message:
        typeof message === "object" ? JSON.stringify(message) : String(message),
      type: asJson ? "json" : "text",
    };

    fetch(this.endpoint, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch((err) => consola.error("Logwatch send failed:", err));
  }

  trace(message: unknown, asJson = false): void {
    consola.trace(this._format(message));
    this._send("trace", message, asJson);
  }

  debug(message: unknown, asJson = false): void {
    consola.debug(this._format(message));
    this._send("debug", message, asJson);
  }

  info(message: unknown, asJson = false): void {
    consola.info(this._format(message));
    this._send("info", message, asJson);
  }

  success(message: unknown, asJson = false): void {
    consola.success(this._format(message));
    this._send("info", message, asJson);
  }

  warn(message: unknown, asJson = false): void {
    consola.warn(this._format(message));
    this._send("warning", message, asJson);
  }

  error(message: unknown, asJson = false): void {
    consola.error(this._format(message));
    this._send("error", message, asJson);
  }

  critical(message: unknown, asJson = false): void {
    consola.fatal(this._format(message));
    this._send("critical", message, asJson);
  }
}

export const logwatch = new Logwatch();
