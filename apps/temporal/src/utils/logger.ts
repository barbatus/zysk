import { pino } from "pino";
import pretty from "pino-pretty";

import { appConfig } from "../config";

const transport = pretty({
  colorize: true,
  translateTime: "yyyy-mm-dd HH:MM:ss.l",
  ignore: "pid,hostname",
});

export const logger = pino(
  {
    name: "temporal",
    level: appConfig.logLevel ?? "info",
    base: undefined,
  },
  transport,
);
