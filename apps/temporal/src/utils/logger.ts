import { type DestinationStream, pino, transport } from "pino";

import { appConfig } from "../config";

const transport_ = transport({
  targets: [
    {
      level: appConfig.logLevel ?? "info",
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "yyyy-mm-dd HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    },
  ],
}) as DestinationStream;

export const logger = pino(
  {
    name: "temporal",
    level: appConfig.logLevel ?? "info",
    base: undefined,
  },
  transport_,
);
