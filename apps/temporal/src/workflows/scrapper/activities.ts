import { scrapeUrls } from "@zysk/scrapper";
import { getAppConfigStatic, NodeEnvironment } from "@zysk/services";
import IORedis, { type RedisOptions } from "ioredis";
import { mapKeys } from "lodash";

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

const redis = new IORedis(
  config.nodeEnv === NodeEnvironment.DEVELOPMENT
    ? {
        host: "localhost",
        port: 6379,
        maxRetriesPerRequest: null,
      }
    : redisOptions,
);

export async function scrapeUrlsViaBrowser(params: {
  urls: string[];
  useProxy?: boolean;
  convertToMd?: boolean;
  waitFor?: number;
  timeout?: number;
}) {
  const {
    urls,
    useProxy = true,
    convertToMd = true,
    waitFor,
    timeout,
  } = params;
  const cachedUrls = mapKeys(
    (
      await Promise.allSettled(
        urls.map((url) =>
          redis.get(
            `scrapper:urls:format:${convertToMd ? "md" : "html"}:${url}`,
          ),
        ),
      )
    )
      .map((r, index) => {
        if (r.status === "fulfilled" && r.value) {
          return {
            url: urls[index],
            content: r.value,
          } as {
            url: string;
            content?: string;
            error?: Error;
          };
        }
        return null;
      })
      .filter(Boolean),
    "url",
  );

  const newUrls = urls.filter((url) => !(url in cachedUrls));

  const result = await scrapeUrls({
    urls: newUrls,
    useProxy,
    convertToMd,
    waitFor,
    timeout,
  });

  await Promise.allSettled(
    result
      .filter((r) => !r.error && r.content)
      .map((r) =>
        redis.set(
          `scrapper:urls:format:${convertToMd ? "md" : "html"}:${r.url}`,
          r.content!,
          "EX",
          "5 minutes",
        ),
      ),
  );

  return Object.values(cachedUrls).concat(result);
}
