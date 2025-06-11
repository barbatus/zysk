import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 2,
  },
  taskQueue: "zysk-scrapper",
});

export async function scrapeUrl(url: string) {
  return proxy.scrapeUrlViaBrowser(url);
}

export async function testScrapeNews() {
  const news = await proxy.scrapeUrlViaBrowser(
    `https://finnhub.io/api/news?id=dd2e6faf9bf2138b2904793cf03d3257d77b07d316db23734569622086e255b6`,
  );
  console.log(news);
}
