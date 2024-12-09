import consola from "consola";

class Logwatch {
  /**
   * Create a Logwatch instance
   * @param {string} endpoint - Log endpoint URL
   */
  constructor(endpoint) {
    const BOT_ENDPOINT =
      "https://logwatch.fairdataihub.org/api/log/cm4hkn79200027r01ya9gij7r";

    if (!endpoint) {
      this.endpoint = BOT_ENDPOINT;
    } else {
      this.endpoint = endpoint;
    }
  }

  /**
   * Internal method to send log to endpoint
   * @param {string} level - Log level
   * @param {string|object} message - Log message or JSON object
   * @param {string} [type='text'] - Type of log message (text or json)
   */
  async _sendLog(level, message, type = "text") {
    let logPayload;

    if (type === "json" && typeof message === "object") {
      logPayload = {
        level,
        message: JSON.stringify(message),
        type: "json",
      };
    } else {
      logPayload = {
        level,
        message:
          typeof message === "object"
            ? JSON.stringify(message)
            : String(message),
        type: "text",
      };
    }

    try {
      // Use fetch for non-blocking request
      fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(logPayload),
      }).catch(consola.error);
    } catch (error) {
      // Silently handle logging errors
      consola.error("Logging failed:", error);
    }
  }

  /**
   * Trace level logging
   * @param {string|object} message - Log message
   * @param {boolean} [isJson=false] - Whether the message is a JSON object
   */
  trace(message, isJson = false) {
    consola.trace(message);
    this._sendLog("trace", message, isJson ? "json" : "text");
  }

  /**
   * Debug level logging
   * @param {string|object} message - Log message
   * @param {boolean} [isJson=false] - Whether the message is a JSON object
   */
  debug(message, isJson = false) {
    consola.debug(message);
    this._sendLog("debug", message, isJson ? "json" : "text");
  }

  /**
   * Info level logging
   * @param {string|object} message - Log message
   * @param {boolean} [isJson=false] - Whether the message is a JSON object
   */
  info(message, isJson = false) {
    consola.info(message);
    this._sendLog("info", message, isJson ? "json" : "text");
  }

  /**
   * Warning level logging
   * @param {string|object} message - Log message
   * @param {boolean} [isJson=false] - Whether the message is a JSON object
   */
  warn(message, isJson = false) {
    consola.warn(message);
    this._sendLog("warning", message, isJson ? "json" : "text");
  }

  /**
   * Error level logging
   * @param {string|object} message - Log message
   * @param {boolean} [isJson=false] - Whether the message is a JSON object
   */
  error(message, isJson = false) {
    consola.error(message);
    this._sendLog("error", message, isJson ? "json" : "text");
  }

  /**
   * Critical level logging
   * @param {string|object} message - Log message
   * @param {boolean} [isJson=false] - Whether the message is a JSON object
   */
  critical(message, isJson = false) {
    consola.fatal(message);
    this._sendLog("critical", message, isJson ? "json" : "text");
  }
}

// Create and export a singleton instance
export default new Proxy(new Logwatch(process.env.LOG_ENDPOINT), {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    }
    throw new Error(`Method ${prop} does not exist on Logwatch`);
  },
});

// Create an instance and export it along with the class
export const logwatch = new Logwatch(process.env.LOG_ENDPOINT);
export { Logwatch };

// ~Text logging~
// logwatch.info("This is a text log");

// ~JSON logging~
// logwatch.debug({
//   userId: 123,
//   action: 'login',
//   timestamp: new Date()
// }, true);

// ~Automatic string conversion~
// logwatch.warn({ key: 'value' });  // Will convert to string
