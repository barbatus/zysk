import { executeChild, proxyActivities, ApplicationFailure, uuid4 } from "@temporalio/workflow";
import { StockNewsStatus } from "@zysk/db";
import { endOfWeek, parse, startOfDay } from "date-fns";
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

export async function runScrapeTickerNews(
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

  const attemptedNews = results.flatMap((r) => {
    if (r.status === "fulfilled") {
      return r.value;
    }
    return [];
  });

  const scrapedNews = attemptedNews.filter(n => n.status === StockNewsStatus.Scraped);
  const successRate = Math.round(scrapedNews.length / attemptedNews.length * 100);
  if (successRate >= 0.8) {
    return attemptedNews;
  }
  throw ApplicationFailure.create({
    type: "ScrapeError",
    message: `Success rate of news scraping is ${successRate}%`,
    nonRetryable: true,
  });
}

export async function runExtractNewsInsights(
  symbol: string,
  newsIds: string[],
) {
  const newsBatches = await proxy.runBatchNews({
    newsIds,
    taskName: "runNewsInsightsExtractorExperiment",
  });

  await Promise.all(
    newsBatches.map(async (newsBatch) => {
      return proxy.runNewsInsightsExtractorExperiment({
        symbol,
        newsIds: newsBatch,
        experimentId: uuid4(),
      });
    }),
  );
}

export async function scrapeTickerNewsForPeriod(
  symbol: string,
  startDate: Date,
  endDate?: Date,
) {
  const currentNews = await proxy.fetchTickerNews(symbol, startDate, endDate);
  const news = await runScrapeTickerNews(symbol, currentNews);
  await executeChild(runExtractNewsInsights, {
    args: [
      symbol,
      news.filter((n) => n.status === StockNewsStatus.Scraped).map((n) => n.id),
    ],
  });
}

export async function scrapeMarketNewsForPeriod(startDate: Date, endDate?: Date) {
  await scrapeTickerNewsForPeriod("GENERAL", startDate, endDate);
}

export async function syncGeneralNewsDaily() {
  const sinceDates = await proxy.getNewsToFetchDaily(["GENERAL"]);

  await executeChild(scrapeTickerNewsForPeriod, {
    args: ["GENERAL", sinceDates[0].startDate],
  });
}

export async function syncTickerNewsDaily(symbols: string[]) {
  const symbolsSince = await proxy.getNewsToFetchDaily(symbols);

  for (const { symbol, startDate } of symbolsSince) {
    await executeChild(scrapeTickerNewsForPeriod, {
      args: [symbol, startDate],
    });
  }
}

export async function syncTickerNewsWeekly(symbols: string[]) {
  const symbolsSince = await proxy.getNewsToFetchWeekly(symbols);

  for (const { symbol, failedNews, sinceDate } of symbolsSince) {
    if (sinceDate) {
      await executeChild(scrapeTickerNewsForPeriod, {
        args: [symbol, sinceDate],
      });
    } else {
      await executeChild(runScrapeTickerNews, {
        args: [symbol, failedNews],
      });
    }
  }
}

export async function syncGeneralNewsWeekly() {
  await executeChild(syncTickerNewsWeekly, {
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
  await executeChild(syncTickerNewsWeekly, {
    args: [symbols],
  });
}

export async function testInsightsExtract() {
  const startDate = parse("2025-06-02", "yyyy-MM-dd", new Date());
  await scrapeTickerNewsForPeriod(
    "UBER",
    startOfDay(startDate),
    endOfWeek(startDate),
  );
}
