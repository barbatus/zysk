import {
  ApplicationFailure,
  executeChild,
  proxyActivities,
  uuid4,
} from "@temporalio/workflow";
import { StockNewsStatus } from "@zysk/db";
import { endOfWeek, parse, startOfWeek } from "date-fns";
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

const scrapperProxy = proxyActivities<{
  scrapeNews: typeof activities.scrapeNews;
}>({
  startToCloseTimeout: "5 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 3,
  },
  taskQueue: "zysk-scrapper",
});

export async function scrapeTickerNewsUrls(
  news: { newsDate: Date; url: string; symbol: string; title: string }[],
) {
  const itemByUrl = mapKeys(news, "url");

  const result = await scrapperProxy
    .scrapeNews(news.map((n) => n.url))
    .then((r) =>
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
  const successRate = Math.round(
    (scrapedNews.length / attemptedNews.length) * 100,
  );
  if (successRate >= 80) {
    return scrapedNews;
  }
  throw ApplicationFailure.create({
    type: "ScrapeError",
    message: `Success rate of the scraping is ${successRate}% lower than 80%`,
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
  const scrapedNews = await runScrapeTickerNews(symbol, currentNews);
  await executeChild(runExtractNewsInsights, {
    args: [symbol, scrapedNews.map((n) => n.id)],
  });
}

export async function scrapeMarketNewsForPeriod(
  startDate: Date,
  endDate?: Date,
) {
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
  const startDate = parse("2025-03-10", "yyyy-MM-dd", new Date());
  for (const symbols of chunk(["CRM", "NVDA"], 5)) {
    await Promise.all(
      symbols.map((symbol) =>
        scrapeTickerNewsForPeriod(
          symbol,
          startOfWeek(startDate),
          endOfWeek(startDate),
        ),
      ),
    );
  }
}
