import { executeChild, proxyActivities } from "@temporalio/workflow";
import { isMonday, parse, startOfDay, startOfWeek, subDays, addDays } from "date-fns";

import {
  syncAllNewsDaily,
  syncMarketNewsForPeriod,
  syncTickerNewsForPeriod,
} from "../stock-news/workflows";
import {
  syncTickerQuotesDaily,
  syncTickerQuotesForPeriod,
} from "../ticker-data/workflows";
import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 minutes",
  heartbeatTimeout: "10 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 2,
  },
});

export async function runTickerSentimentPredictionExperiment(
  symbol: string,
  startDate: Date,
  endDate: Date,
) {
  const { newsBatchIds, timeSeries } =
    await proxy.fetchSentimentPredictionExperimentData({
      symbol,
      startDate,
      endDate,
    });

  const predictions = await Promise.all(
    newsBatchIds.map((newsBatchId) =>
      proxy.runTickerSentimentPredictionExperiment({
        symbol,
        newsIds: newsBatchId,
        timeSeries,
        currentDate: endDate,
      }),
    ),
  );

  return proxy.makePredictions({
    symbol,
    predictions,
    currentDate: endDate,
  });
}

export async function runMarketSentimentPredictionExperiment(
  startDate: Date,
  endDate: Date,
) {
  const newsBatches = await proxy.fetchNewsForPeriod({
    symbol: "GENERAL",
    startDate,
    endDate,
  });

  const predictions = await Promise.all(
    newsBatches.map((batch) =>
      proxy.runMarketSentimentPredictionExperiment({
        newsIds: batch,
        currentDate: endDate,
      }),
    ),
  );

  return proxy.makePredictions({
    symbol: "GENERAL",
    predictions,
    currentDate: endDate,
  });
}

export async function runTickerSentimentPredictionExperiments(
  symbols: string[],
  startDate: Date,
  endDate: Date,
) {
  await Promise.all(
    symbols.map((symbol) =>
      runTickerSentimentPredictionExperiment(symbol, startDate, endDate),
    ),
  );
}

const getPrevDate = (currentDate: Date) => {
  const prevDate = subDays(currentDate, isMonday(currentDate) ? 2 : 1);
  return startOfDay(prevDate);
};

export async function predictSentimentsDaily() {
  const symbols = await proxy.getSupportedTickers();

  const currentDate = new Date();

  const prevDate = getPrevDate(currentDate);

  await executeChild(syncTickerQuotesDaily, {
    args: [symbols],
  });

  await executeChild(syncAllNewsDaily, {
    args: [symbols],
  });
  await executeChild(runMarketSentimentPredictionExperiment, {
    args: [prevDate, currentDate],
  });

  await runTickerSentimentPredictionExperiments(symbols, prevDate, currentDate);
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

  const currentWeekDate = getStartWeekDate(
    parse(startWeek, "yyyy-MM-dd", new Date()),
  );
  const prevWeekDate = subDays(currentWeekDate, 7);

  await Promise.all([
    executeChild(syncTickerQuotesForPeriod, {
      args: [[symbol], subDays(prevWeekDate, 7), addDays(currentWeekDate, 7)],
    }),
    executeChild(syncMarketNewsForPeriod, {
      args: [prevWeekDate, currentWeekDate],
    }),
    executeChild(syncTickerNewsForPeriod, {
      args: [symbol, prevWeekDate, currentWeekDate],
    }),
  ]);
  await executeChild(runMarketSentimentPredictionExperiment, {
    args: [prevWeekDate, currentWeekDate],
  });

  await runTickerSentimentPredictionExperiments(
    [symbol],
    prevWeekDate,
    currentWeekDate,
  );
}

export async function testMeta() {
  await predictSentimentWeekly({
    symbol: "META",
    startWeek: "2024-10-07",
  });
}
