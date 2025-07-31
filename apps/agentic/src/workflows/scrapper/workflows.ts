import { ApplicationFailure, proxyActivities } from "@temporalio/workflow";
import { type StockNewsSource, StockNewsStatus } from "@zysk/db";
import { chunk } from "lodash";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 day",
  heartbeatTimeout: "5 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 5,
  },
  taskQueue: "zysk-scrapper",
});

export async function scrapeUrls(urls: string[]) {
  return proxy.scrapeUrls({ urls });
}

export async function runScrapeTickerNews(params: {
  symbol?: string;
  news: {
    url: string;
    title?: string;
    newsDate: Date;
    source: StockNewsSource;
  }[];
}) {
  const { symbol, news } = params;

  const attemptedNews = (
    await Promise.allSettled(
      chunk(news, 30).map((batch) =>
        proxy.scrapeTickerNewsUrlsAndSave({ symbol, news: batch }),
      ),
    )
  ).flat();

  const scrapedNews = attemptedNews
    .filter((n) => n.status === "fulfilled")
    .flatMap((n) => n.value)
    .filter(
      (n) =>
        n.status === StockNewsStatus.Scraped ||
        n.status === StockNewsStatus.InsightsExtracted,
    );
  const successRate =
    attemptedNews.length > 0
      ? Math.round((scrapedNews.length / attemptedNews.length) * 100)
      : 0;
  if (successRate >= 90) {
    return scrapedNews;
  }
  throw ApplicationFailure.create({
    type: "ScrapeError",
    message: `Success rate of the scraping is ${successRate}% lower than 90%`,
  });
}

export async function testScrapeNews() {
  const news = await proxy.scrapeUrls({
    urls: [
      `https://finnhub.io/api/news?id=dd2e6faf9bf2138b2904793cf03d3257d77b07d316db23734569622086e255b6`,
    ],
  });
  console.log(news);
}
