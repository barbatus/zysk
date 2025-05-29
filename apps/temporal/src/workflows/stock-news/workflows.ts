import { executeChild, proxyActivities } from "@temporalio/workflow";
import { StockNewsStatus } from "@zysk/db";
import { chunk, mapKeys, omit, uniqBy } from "lodash";

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
  news: { newsDate: Date; url: string; symbol: string; title: string }[],
) {
  const callScrapeSymbolNews = async (item: {
    newsDate: Date;
    url: string;
    symbol: string;
    title: string;
  }) => {
    return proxy.scrapeSymbolNews(item.url).catch(async () => {
      return {
        ...item,
        originalUrl: item.url,
        markdown: null,
        status: StockNewsStatus.Failed,
        tokenSize: 0,
      };
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
  batch: { newsDate: Date; url: string; title: string }[],
) {
  const newsDateMap = mapKeys(batch, "url");
  const scrapedNews = await executeChild(scrapeSymbolNewsUrls, {
    args: [batch.map((b) => ({ ...b, symbol }))],
  });

  const uniqueNews = uniqBy(
    scrapedNews.flat().map((n) => ({
      status: StockNewsStatus.Scraped,
      ...omit(n, "originalUrl"),
      symbol,
      newsDate: newsDateMap[n.originalUrl].newsDate,
    })),
    (n) => `${n.symbol}-${n.url}`,
  );
  await proxy.saveNews(uniqueNews);
}

export async function scrapeSymbolNewsSince(symbol: string, sinceDate: Date) {
  const currentNews = await proxy.fetchSymbolNews(symbol, sinceDate);
  for (let i = 0; i < currentNews.length; i += 80) {
    await scrapeSymbolNews(symbol, currentNews.slice(i, i + 80));
  }
}

export async function scrapeSymbolNews(
  symbol: string,
  news: { url: string; title: string; newsDate: Date }[],
) {
  for (let i = 0; i < news.length; i += 80) {
    await Promise.allSettled(
      // Scraping by 20 URLs to make to sure it does not exceed gRPC size limit
      // and all together 80 URLs in parralel to respect firecrawl rate limits.
      chunk(news.slice(i, i + 80), 20).map((batch) =>
        executeChild(scrapeSymbolNewsBatchAndSave, {
          args: [symbol, batch],
        }),
      ),
    );
  }
}

export async function scrapeGeneralNewsDaily() {
  const sinceDates = await proxy.getNewsToFetchDaily(["GENERAL"]);

  await executeChild(scrapeSymbolNewsSince, {
    args: ["GENERAL", sinceDates[0].sinceDate],
  });
}

export async function scrapeSymbolNewsDaily(symbols: string[]) {
  const symbolsSince = await proxy.getNewsToFetchDaily(symbols);

  for (const { symbol, sinceDate } of symbolsSince) {
    await executeChild(scrapeSymbolNewsSince, {
      args: [symbol, sinceDate],
    });
  }
}

export async function scrapeSymbolNewsWeekly(symbols: string[]) {
  const symbolsSince = await proxy.getNewsToFetchWeekly(symbols);

  for (const { symbol, failedNews, sinceDate } of symbolsSince) {
    if (sinceDate) {
      await executeChild(scrapeSymbolNewsSince, {
        args: [symbol, sinceDate],
      });
    } else {
      await executeChild(scrapeSymbolNews, {
        args: [symbol, failedNews],
      });
    }
  }
}

export async function scrapeGeneralNewsWeekly() {
  await scrapeSymbolNewsWeekly(["GENERAL"]);
}

export async function scrapeAllNewsDaily(symbols: string[]) {
  await executeChild(scrapeGeneralNewsDaily);
  await executeChild(scrapeSymbolNewsDaily, {
    args: [symbols],
  });
}

export async function scrapeAllNewsWeekly(symbols: string[]) {
  await executeChild(scrapeGeneralNewsWeekly);
  await executeChild(scrapeSymbolNewsWeekly, {
    args: [symbols],
  });
}
