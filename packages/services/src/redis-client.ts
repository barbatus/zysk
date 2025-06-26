import Redis, { type RedisOptions } from "ioredis";

import { getAppConfigStatic, NodeEnvironment } from "./config";

const config = getAppConfigStatic();

const redisOptions: RedisOptions = {
  host: config.upstash?.redisRestUrl,
  port: 6379,
  username: "default",
  password: config.upstash?.redisRestToken,
  family: 6,
  maxRetriesPerRequest: null,
  tls: {},
};

export const redisClientSymbol = Symbol("redisClient");

export function getRedisClient() {
  return new Redis(
    config.nodeEnv === NodeEnvironment.DEVELOPMENT
      ? {
          host: "localhost",
          port: 6379,
          maxRetriesPerRequest: null,
        }
      : redisOptions,
  );
}
