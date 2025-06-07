import { executeChild, proxyActivities } from "@temporalio/workflow";
import { StockNewsStatus } from "@zysk/db";
import { endOfDay, parse, startOfDay } from "date-fns";
import { chunk, mapKeys, uniqBy } from "lodash";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 5,
    maximumInterval: "5m",
  },
});

export async function scrapeTickerNewsUrls(
  news: { newsDate: Date; url: string; symbol: string; title: string }[],
) {
  const callScrapeSymbolNews = async (item: {
    newsDate: Date;
    url: string;
    symbol: string;
    title: string;
  }) => {
    const result = await proxy.scrapeNews(item.url).catch(async () => {
      return {
        ...item,
        originalUrl: item.url,
        markdown: null,
        status: StockNewsStatus.Failed,
        tokenSize: 0,
      };
    });

    return {
      ...item,
      ...result,
    };
  };

  return Promise.allSettled(news.map(callScrapeSymbolNews)).then((result) =>
    result
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter(Boolean),
  );
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
    scrapedNews.flat().map((n) => ({
      status: StockNewsStatus.Scraped,
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

export async function syncTickerNews(
  symbol: string,
  news: { url: string; title: string; newsDate: Date }[],
) {
  const results: PromiseSettledResult<
    { id: string; status: StockNewsStatus }[]
  >[] = [];
  for (let i = 0; i < news.length; i += 100) {
    results.push(
      ...(await Promise.allSettled(
        chunk(news.slice(i, i + 100), 20).map((batch) =>
          executeChild(scrapeTickerNewsBatchAndSave, {
            args: [symbol, batch],
          }),
        ),
      )),
    );
  }

  return results.flatMap((r) => {
    if (r.status === "fulfilled") {
      return r.value;
    }
    return [];
  });
}

export async function syncExtractNewsInsights(
  symbol: string,
  newsIds: string[],
) {
  const newsBatches = await proxy.runBatchNews({ newsIds });

  await Promise.all(
    newsBatches.map(async (newsBatch) => {
      return proxy.runNewsInsightsExtractorExperiment({
        symbol,
        newsIds: newsBatch,
      });
    }),
  );
}

export async function syncTickerNewsForPeriod(
  symbol: string,
  startDate: Date,
  endDate?: Date,
) {
  const currentNews = await proxy.fetchTickerNews(symbol, startDate, endDate);
  const news = await syncTickerNews(symbol, currentNews);
  await executeChild(syncExtractNewsInsights, {
    args: [
      symbol,
      news.filter((n) => n.status === StockNewsStatus.Scraped).map((n) => n.id),
    ],
  });
}

export async function syncMarketNewsForPeriod(startDate: Date, endDate?: Date) {
  await syncTickerNewsForPeriod("GENERAL", startDate, endDate);
}

export async function syncGeneralNewsDaily() {
  const sinceDates = await proxy.getNewsToFetchDaily(["GENERAL"]);

  await executeChild(syncTickerNewsForPeriod, {
    args: ["GENERAL", sinceDates[0].startDate],
  });
}

export async function syncTickerNewsDaily(symbols: string[]) {
  const symbolsSince = await proxy.getNewsToFetchDaily(symbols);

  for (const { symbol, startDate } of symbolsSince) {
    await executeChild(syncTickerNewsForPeriod, {
      args: [symbol, startDate],
    });
  }
}

export async function scrapeTickerNewsWeekly(symbols: string[]) {
  const symbolsSince = await proxy.getNewsToFetchWeekly(symbols);

  for (const { symbol, failedNews, sinceDate } of symbolsSince) {
    if (sinceDate) {
      await executeChild(syncTickerNewsForPeriod, {
        args: [symbol, sinceDate],
      });
    } else {
      await executeChild(syncTickerNews, {
        args: [symbol, failedNews],
      });
    }
  }
}

export async function syncGeneralNewsWeekly() {
  await executeChild(scrapeTickerNewsWeekly, {
    args: [["GENERAL"]],
  });
}

export async function syncAllNewsDaily(symbols: string[]) {
  await executeChild(syncGeneralNewsDaily);
  await executeChild(syncTickerNewsDaily, {
    args: [symbols],
  });
}

export async function syncAllNewsWeekly(symbols: string[]) {
  await executeChild(syncGeneralNewsWeekly);
  await executeChild(scrapeTickerNewsWeekly, {
    args: [symbols],
  });
}

export async function testInsightsExtract() {
  const startDate = parse("2025-06-06", "yyyy-MM-dd", new Date());
  await syncTickerNewsForPeriod(
    "META",
    startOfDay(startDate),
    endOfDay(startDate),
  );
}
