import {
  ApplicationFailure,
  executeChild,
  proxyActivities,
} from "@temporalio/workflow";
import { StockNewsStatus } from "@zysk/db";
import { chunk, mapKeys, omit, uniqBy } from "lodash";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 2,
  },
  taskQueue: "zysk-scrapper",
});

export async function scrapeUrls(urls: string[]) {
  return proxy.scrapeUrls({ urls });
}

export async function scrapeTickerNewsUrls(
  news: { newsDate: Date; url: string; symbol: string; title: string }[],
) {
  const itemByUrl = mapKeys(news, "url");

  const result = await proxy.scrapeNews(news.map((n) => n.url)).then((r) =>
    r.map((n) => ({
      ...itemByUrl[n.url],
      ...omit(n, "error"),
      status: n.error ? StockNewsStatus.Failed : StockNewsStatus.Scraped,
    })),
  );

  return result;
}

export async function scrapeTickerNewsBatchAndSave(
  symbol: string,
  batch: { newsDate: Date; url: string; title: string }[],
) {
  const newsDateMap = mapKeys(batch, "url");
  const scrapedNews = await executeChild(scrapeTickerNewsUrls, {
    args: [batch.map((b) => ({ ...b, symbol }))],
  });

  const uniqueNews = uniqBy(
    scrapedNews.map((n) => ({
      ...n,
      symbol,
      newsDate: newsDateMap[n.originalUrl].newsDate,
    })),
    (n) => `${n.symbol}-${n.url}`,
  );

  return (await proxy.saveNews(uniqueNews)).map((n) => ({
    id: n.id,
    status: n.status,
  }));
}

export async function runScrapeTickerNews(
  symbol: string,
  news: { url: string; title: string; newsDate: Date }[],
) {
  const attemptedNews = (
    await Promise.all(
      chunk(news, 15).map((batch) =>
        executeChild(scrapeTickerNewsBatchAndSave, {
          args: [symbol, batch],
        }),
      ),
    )
  ).flat();

  const scrapedNews = attemptedNews.filter(
    (n) => n.status === StockNewsStatus.Scraped,
  );
  const successRate =
    attemptedNews.length > 0
      ? Math.round((scrapedNews.length / attemptedNews.length) * 100)
      : 0;
  if (successRate >= 80) {
    return scrapedNews;
  }
  throw ApplicationFailure.create({
    type: "ScrapeError",
    message: `Success rate of the scraping is ${successRate}% lower than 80%`,
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
