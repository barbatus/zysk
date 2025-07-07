import { executeChild, proxyActivities, uuid4 } from "@temporalio/workflow";
import { addDays, parse, startOfWeek, subDays } from "date-fns";
import { chunk } from "lodash";

import { getUpcomingWeekDate } from "#/utils/datetime";

import type * as newsActivities from "../stock-news/activities";
import {
  scrapeMarketNewsForPeriod,
  scrapeTickerNewsForPeriod,
  syncAllNewsDaily,
} from "../stock-news/workflows";
import {
  syncTickerQuotesDaily,
  syncTickerQuotesForPeriod,
} from "../ticker-data/workflows";
import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities & typeof newsActivities>({
  startToCloseTimeout: "1 hour",
  heartbeatTimeout: "10 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 2,
  },
});

export async function runTickerSentimentPredictionExperiment(params: {
  symbol: string;
  currentDate: Date;
  type: "daily" | "weekly";
  withScrape: boolean;
}) {
  const { symbol, currentDate, type, withScrape } = params;
  const startDate = await proxy.getLastPredictionDate(
    symbol,
    currentDate,
    type,
  );

  if (withScrape) {
    await executeChild(scrapeTickerNewsForPeriod, {
      args: [symbol, startDate, currentDate],
    });
  }

  const { newsBatchIds, timeSeries } =
    await proxy.fetchSentimentPredictionExperimentData({
      symbol,
      startDate,
      endDate: currentDate,
      taskName: "runTickerSentimentPredictionExperiment",
    });

  const predictions = await Promise.all(
    newsBatchIds.map((newsIds) =>
      proxy.runTickerSentimentPredictionExperiment({
        symbol,
        newsIds,
        timeSeries,
        currentDate,
        experimentId: uuid4(),
      }),
    ),
  );

  return proxy.makePredictions({
    symbol,
    predictions,
    currentDate,
  });
}

export async function runMarketSentimentPredictionExperimentWeekly(params: {
  weekStartDate: Date;
  withScrape?: boolean;
}) {
  const { weekStartDate, withScrape } = params;
  const startDate = subDays(weekStartDate, 7);
  const currentDate = weekStartDate;

  const lastPrediction = await proxy.getMarketSentimentPrediction(currentDate);
  if (lastPrediction) {
    return lastPrediction;
  }

  if (withScrape) {
    const prevWeekDate = subDays(weekStartDate, 7);
    await executeChild(scrapeMarketNewsForPeriod, {
      args: [prevWeekDate, weekStartDate],
    });
  }

  const newsBatches = await proxy.fetchNewsInsightsForPeriod({
    symbol: "GENERAL",
    startDate,
    endDate: currentDate,
    taskName: "runMarketSentimentPredictionExperiment",
  });

  const predictions = await Promise.all(
    newsBatches.map((batch) =>
      proxy.runMarketSentimentPredictionExperiment({
        newsIds: batch,
        currentDate,
      }),
    ),
  );

  return proxy.makePredictions({
    symbol: "GENERAL",
    predictions,
    currentDate,
  });
}

export async function runTickerSentimentPredictionExperiments(params: {
  symbols: string[];
  currentDate: Date;
  withScrape: boolean;
  type: "daily" | "weekly";
}) {
  const { symbols, currentDate, withScrape, type } = params;
  await Promise.all(
    symbols.map((symbol) =>
      runTickerSentimentPredictionExperiment({
        symbol,
        currentDate,
        withScrape,
        type,
      }),
    ),
  );
}

export async function predictSentimentsDaily() {
  const symbols = await proxy.getSupportedTickers();

  const currentDate = new Date();

  await executeChild(syncTickerQuotesDaily, {
    args: [symbols],
  });
  await executeChild(syncAllNewsDaily, {
    args: [symbols],
  });

  const currentWeekDate = getStartWeekDate(currentDate);
  await executeChild(runMarketSentimentPredictionExperimentWeekly, {
    args: [{ weekStartDate: currentWeekDate, withScrape: false }],
  });

  await runTickerSentimentPredictionExperiments({
    symbols,
    currentDate,
    withScrape: false,
    type: "daily",
  });
}

const getStartWeekDate = (date: Date) =>
  startOfWeek(date, {
    weekStartsOn: 1,
  });

export async function predictSentimentWeekly(params: {
  symbol: string;
  startWeek: string;
}) {
  const { symbol, startWeek } = params;

  const currentWeekDate = getUpcomingWeekDate(
    parse(startWeek, "yyyy-MM-dd", new Date()),
  );
  const prevWeekDate = subDays(currentWeekDate, 7);

  await Promise.all([
    executeChild(syncTickerQuotesForPeriod, {
      args: [[symbol], subDays(prevWeekDate, 7), addDays(currentWeekDate, 7)],
    }),
    executeChild(runMarketSentimentPredictionExperimentWeekly, {
      args: [{ weekStartDate: currentWeekDate, withScrape: true }],
    }),
  ]);

  await runTickerSentimentPredictionExperiments({
    symbols: [symbol],
    currentDate: currentWeekDate,
    withScrape: true,
    type: "weekly",
  });
}

export async function evaluatePredictions() {
  const periodsToSync = await proxy.syncQuotesForPredictions();
  await Promise.all(
    chunk(periodsToSync, 10).map((batch) =>
      proxy.evaluatePredictions(batch.map(({ symbol }) => symbol)),
    ),
  );
}

export async function testTicker() {
  const symbols = [
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
  ];
  await Promise.allSettled(
    symbols.map((symbol) =>
      predictSentimentWeekly({
        symbol,
        startWeek: "2025-07-07",
      }),
    ),
  );
}
