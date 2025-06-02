import { type ConnectionOptions, Queue, Worker } from "bullmq";
import IORedis from "ioredis";

import { scrapeUrl } from "./browser";
import { getAppConfigStatic } from "./config";

interface ScrapeJobData {
  url: string;
  useBrowserApi?: boolean;
  useProxy?: boolean;
  convertToMd?: boolean;
  waitFor?: number;
  timeout?: number;
}

const config = getAppConfigStatic();

const redisOptions: ConnectionOptions = {
  host: config.upstashRedisUrl,
  port: 6379,
  username: "default",
  password: config.upstashRedisPassword,
  family: 6,
  maxRetriesPerRequest: null,
  tls: {},
};

const redis = new IORedis(redisOptions);

export const QUEUE_NAME = "scrape-queue";

export const scrapeQueue = new Queue<ScrapeJobData>(QUEUE_NAME, {
  connection: redis,
});

const worker = new Worker<ScrapeJobData>(
  QUEUE_NAME,
  async (job) => {
    const { url, useBrowserApi, useProxy, convertToMd, waitFor, timeout } =
      job.data;

    try {
      const result = await scrapeUrl({
        url,
        useBrowserApi,
        useProxy,
        convertToMd,
        waitFor,
        timeout,
      });

      return { content: result.content, url: result.url };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        errorStatus: 500,
      };
    }
  },
  {
    connection: redis,
    concurrency: 10,
    limiter: {
      max: 10,
      duration: 90_000,
    },
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});
