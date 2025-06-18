import { executeChild, proxyActivities, uuid4 } from "@temporalio/workflow";
import { addDays, parse } from "date-fns";
import { chunk } from "lodash";

import { runScrapeTickerNews } from "#/workflows/scrapper/workflows";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 5,
    maximumInterval: "5m",
  },
});

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
  const startDate = parse("2025-02-03", "yyyy-MM-dd", new Date());
  for (const symbols of chunk(["NVDA", "TSLA"], 5)) {
    await Promise.all(
      symbols.map((symbol) =>
        scrapeTickerNewsForPeriod(symbol, startDate, addDays(startDate, 7)),
      ),
    );
  }
}
