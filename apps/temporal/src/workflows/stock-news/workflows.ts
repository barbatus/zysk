import { executeChild, proxyActivities } from "@temporalio/workflow";
import { StockNewsStatus } from "@zysk/db";
import { chunk, mapKeys, omit } from "lodash";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 5,
    maximumInterval: "5m",
  },
});

export async function scrapeSymbolNewsUrls(
  news: { newsDate: Date; url: string; symbol: string }[],
) {
  const callScrapeSymbolNews = async (item: {
    newsDate: Date;
    url: string;
    symbol: string;
  }) => {
    return proxy.scrapeSymbolNews(item.url).catch(async (error) => {
      await proxy.saveNews([
        {
          ...item,
          status: StockNewsStatus.Failed,
          tokenSize: 0,
        },
      ]);
      throw error;
    });
  };

  return Promise.allSettled(news.map(callScrapeSymbolNews)).then((result) =>
    result
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter(Boolean),
  );
}

export async function scrapeSymbolNewsBatchAndSave(
  symbol: string,
  batch: { newsDate: Date; url: string }[],
) {
  const newsDateMap = mapKeys(batch, "url");
  const scrapedNews = await executeChild(scrapeSymbolNewsUrls, {
    args: [batch.map((b) => ({ ...b, symbol }))],
  });
  await proxy.saveNews(
    scrapedNews
      .flat()
      .map((n) =>
        n.markdown
          ? {
              ...omit(n, "originalUrl"),
              symbol,
              markdown: n.markdown,
              newsDate: newsDateMap[n.originalUrl].newsDate,
              status: StockNewsStatus.Scraped,
            }
          : null,
      )
      .filter(Boolean),
  );
}

export async function scrapeSymbolNews(symbol: string, sinceDate: Date) {
  const currentNews = await proxy.fetchSymbolNewsByPage(symbol, sinceDate);
  for (let i = 0; i < currentNews.length; i += 60) {
    await Promise.allSettled(
      // Scraping by 20 URLs to make to sure it does not exceed gRPC size limit
      // and all together 80 URLs in parralel to respect firecrawl rate limits.
      chunk(currentNews.slice(i, i + 80), 20).map((batch) =>
        executeChild(scrapeSymbolNewsBatchAndSave, {
          args: [symbol, batch],
        }),
      ),
    );
  }
}

export async function scrapeGeneralNews() {
  const sinceDate = await proxy.fetchGeneralMarketLastNewsDate();

  await executeChild(scrapeSymbolNews, {
    args: ["GENERAL", sinceDate],
  });
}

export async function scrapeTickersNews() {
  const symbols = await proxy.fetchTickersForNews();

  for (const { symbol, sinceDate } of symbols) {
    await executeChild(scrapeSymbolNews, {
      args: [symbol, sinceDate],
    });
  }
}

export async function scrapeAllNews() {
  await executeChild(scrapeGeneralNews);
  await executeChild(scrapeTickersNews);
}
