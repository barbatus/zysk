import Redis, { type RedisOptions } from "ioredis";

import { getAgenticConfigStatic, NodeEnvironment } from "./config";

const config = getAgenticConfigStatic();

const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: 6379,
  username: config.redis.username,
  password: config.redis.password,
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
