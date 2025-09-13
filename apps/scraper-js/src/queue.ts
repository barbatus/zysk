import { PageLoadError, scrapeUrls } from "@zysk/scraper";
import { getRedisClient } from "@zysk/services";
import { Queue, Worker } from "bullmq";

interface ScrapeJobData {
  url: string;
  useBrowserApi?: boolean;
  useProxy?: boolean;
  convertToMd?: boolean;
  waitFor?: number;
  timeout?: number;
}

export const QUEUE_NAME = "scrape-queue";

export const scrapeQueue = new Queue<ScrapeJobData>(QUEUE_NAME, {
  connection: getRedisClient(),
});

const worker = new Worker<ScrapeJobData>(
  QUEUE_NAME,
  async (job) => {
    const { url, useProxy, convertToMd, waitFor, timeout } = job.data;

    try {
      const result = await scrapeUrls({
        urls: [url],
        useProxy,
        convertToMd,
        waitFor,
        timeout,
      });

      return result[0];
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        errorStatus: error instanceof PageLoadError ? error.status : 500,
      };
    }
  },
  {
    connection: getRedisClient(),
    concurrency: 50,
    limiter: {
      max: 50,
      duration: 60_000,
    },
  },
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});
