import { executeChild, proxyActivities, uuid4 } from "@temporalio/workflow";
import {
  addDays,
  parse,
  startOfWeek,
  subDays,
} from "date-fns";
import { chunk } from "lodash";

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
import { getUpcomingWeekDate } from "#/utils/datetime";

const proxy = proxyActivities<typeof activities & typeof newsActivities>({
  startToCloseTimeout: "15 minutes",
  heartbeatTimeout: "10 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 2,
  },
});

export async function runTickerSentimentPredictionExperiment(
  symbol: string,
  currentDate: Date,
  type: "daily" | "weekly",
) {
  const startDate = await proxy.getLastPredictionDate(
    symbol,
    currentDate,
    type,
  );

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

export async function runMarketSentimentPredictionExperimentWeekly(
  weekStartDate: Date,
) {
  const startDate = subDays(weekStartDate, 7);
  const currentDate = weekStartDate;

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

export async function runTickerSentimentPredictionExperiments(
  symbols: string[],
  currentDate: Date,
  type: "daily" | "weekly",
) {
  await Promise.all(
    symbols.map((symbol) =>
      runTickerSentimentPredictionExperiment(symbol, currentDate, type),
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
    args: [currentWeekDate],
  });

  await runTickerSentimentPredictionExperiments(symbols, currentDate, "daily");
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
    executeChild(scrapeMarketNewsForPeriod, {
      args: [prevWeekDate, currentWeekDate],
    }),
  ]);

  await executeChild(runMarketSentimentPredictionExperimentWeekly, {
    args: [currentWeekDate],
  });

  await executeChild(scrapeTickerNewsForPeriod, {
    args: [symbol, prevWeekDate, currentWeekDate],
  });

  await runTickerSentimentPredictionExperiments(
    [symbol],
    currentWeekDate,
    "weekly"
  );
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
  await predictSentimentWeekly({
    symbol: "BA",
    startWeek: "2025-06-30",
  });
}
