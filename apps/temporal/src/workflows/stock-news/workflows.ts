import { executeChild, proxyActivities } from "@temporalio/workflow";
import { type InsertableStockNews, StockNewsStatus } from "@zysk/db";
import { mapKeys } from "lodash";

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

type SymbolNews = Awaited<
  ReturnType<typeof proxy.fetchSymbolNewsByPage>
>[number];
export async function scrapeSymbolNews(symbol: string, sinceDate: Date) {
  const fetchNewsSince = async (page: number) => {
    const news = await proxy
      .fetchSymbolNewsByPage(symbol, page)
      .then((n) => n.filter((a) => a.newsDate >= sinceDate));
    if (news.length === 0) {
      return [];
    }
    return news;
  };

  let page = 1;
  let currentNews: SymbolNews[] = [];
  let hasMore = true;
  while (hasMore) {
    currentNews = await fetchNewsSince(page);
    const scrapedNews: InsertableStockNews[] = [];
    const newsDateMap = mapKeys(currentNews, "url");
    for (let i = 0; i < currentNews.length; i += 100) {
      const tmpScrape = await executeChild(scrapeSymbolNewsUrls, {
        args: [
          currentNews
            .slice(i, i + 100)
            .map((c) => ({ newsDate: c.newsDate, url: c.url, symbol })),
        ],
      });
      scrapedNews.push(
        ...tmpScrape
          .flat()
          .map((n) =>
            n.markdown
              ? {
                  ...n,
                  symbol,
                  markdown: n.markdown,
                  newsDate: newsDateMap[n.url].newsDate,
                  status: StockNewsStatus.Scraped,
                }
              : null,
          )
          .filter(Boolean),
      );
    }
    if (scrapedNews.length > 0) {
      await proxy.saveNews(scrapedNews);
    }
    hasMore = currentNews.length > 0;
    page += 1;
  }
}

export async function scrapeGeneralNews() {
  const sinceDate = await proxy.fetchGeneralLastNewsDate();

  await executeChild(scrapeSymbolNews, {
    args: ["GENERAL", sinceDate],
  });
}

export async function scrapeNews() {
  const symbols = await proxy.fetchSymbolsToProcess();

  for (const { symbol, sinceDate } of symbols) {
    await executeChild(scrapeSymbolNews, {
      args: [symbol, sinceDate],
    });
  }
}
