import { pino } from "pino";
import pretty from "pino-pretty";

import { type AppConfig } from "../config";

export type { Logger } from "pino";

const transport = pretty({
  colorize: true,
  translateTime: "yyyy-mm-dd HH:MM:ss.l",
  ignore: "pid,hostname",
});

export function createLogger(config: AppConfig) {
  return pino(
    {
      name: "temporal",
      level: config.logLevel ?? "info",
      base: undefined,
      formatters: {
        log: (obj) => {
          for (const key in obj) {
            if (typeof obj[key] === "string") {
              obj[key] = obj[key].replace(/\r?\n/g, "");
            }
          }
          return obj;
        },
      },
    },
    transport,
  );
}

export const loggerSymbol: symbol = Symbol.for("Logger");
