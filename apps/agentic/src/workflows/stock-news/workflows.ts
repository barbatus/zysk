import { executeChild, proxyActivities, uuid4 } from "@temporalio/workflow";
import { StockNewsSource, StockNewsStatus } from "@zysk/db";
import { addDays, parse } from "date-fns";
import { chunk } from "lodash";

import { runScrapeTickerNews } from "#/workflows/scrapper/workflows";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 day",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 5,
    maximumInterval: "5m",
  },
});

export async function runExtractNewsInsights(newsIds: string[]) {
  const newsBatches = await proxy.runBatchNews({
    newsIds,
    taskName: "runNewsInsightsExtractorExperiment",
  });

  const experimentId = uuid4();
  await Promise.all(
    newsBatches.map(async (newsBatch) => {
      return proxy
        .runNewsInsightsExtractorExperiment({
          newsIds: newsBatch,
          experimentId,
        })
        .then((insights) =>
          proxy.saveNewsInsights({
            insights,
            experimentId,
          }),
        );
    }),
  );
}

export async function scrapeTickerNewsForPeriod(
  symbol: string,
  startDate: Date,
  endDate?: Date,
) {
  const currentNews = await proxy.fetchTickerNews(symbol, startDate, endDate);

  for (const batch of chunk(currentNews, 100)) {
    const scrapedNews = await executeChild(runScrapeTickerNews, {
      args: [
        {
          symbol,
          news: batch.map((n) => ({
            ...n,
            source: StockNewsSource.Finnhub,
          })),
        },
      ],
      taskQueue: "zysk-scrapper",
    });
    await executeChild(runExtractNewsInsights, {
      args: [
        scrapedNews
          .filter((n) => n.status === StockNewsStatus.Scraped)
          .map((n) => n.id),
      ],
    });
  }
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
        args: [
          {
            symbol,
            news: failedNews.map((n) => ({
              ...n,
              source: StockNewsSource.Finnhub,
            })),
          },
        ],
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
  const startDate = parse("2025-08-04", "yyyy-MM-dd", new Date());
  for (const symbols of chunk(
    [
      "NBIS",
      "PLTR",
      "UBER",
      "RVMD",
      "JNJ",
      "PFE",
      "MRK",
      "LLY",
      "ABBV",
      "UNH",
      "BAC",
      "WFC",
      "GS",
      "MS",
      "C",
      "AXP",
      "BLK",
      "SCHW",
      "TFC",
      "XOM",
      "CVX",
      "COP",
      "OXY",
      "PSX",
      "EOG",
      "MPC",
      "VLO",
      "ALL",
      "AAPL",
      "MSFT",
      "GOOG",
      "AMZN",
      "META",
      "TSLA",
      "NVDA",
      "CSCO",
      "MRK",
    ],
    5,
  )) {
    await Promise.all(
      symbols.map((symbol) =>
        executeChild(scrapeTickerNewsForPeriod, {
          args: [symbol, startDate, addDays(startDate, 7)],
        }),
      ),
    );
  }
}
