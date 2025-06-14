import { executeChild, proxyActivities, uuid4 } from "@temporalio/workflow";
import {
  addDays,
  isMonday,
  parse,
  startOfDay,
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
  startDate: Date,
  endDate: Date,
) {
  const { newsBatchIds, timeSeries } =
    await proxy.fetchSentimentPredictionExperimentData({
      symbol,
      startDate,
      endDate,
      taskName: "runTickerSentimentPredictionExperiment",
    });

  const predictions = await Promise.all(
    newsBatchIds.map((newsIds) =>
      proxy.runTickerSentimentPredictionExperiment({
        symbol,
        newsIds,
        timeSeries,
        currentDate: endDate,
        experimentId: uuid4(),
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
  const newsBatches = await proxy.fetchNewsInsightsForPeriod({
    symbol: "GENERAL",
    startDate,
    endDate,
    taskName: "runMarketSentimentPredictionExperiment",
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
    executeChild(scrapeMarketNewsForPeriod, {
      args: [prevWeekDate, currentWeekDate],
    }),
  ]);

  await executeChild(runMarketSentimentPredictionExperiment, {
    args: [prevWeekDate, currentWeekDate],
  });

  await executeChild(scrapeTickerNewsForPeriod, {
    args: [symbol, prevWeekDate, currentWeekDate],
  });

  await runTickerSentimentPredictionExperiments(
    [symbol],
    prevWeekDate,
    currentWeekDate,
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
    symbol: "AAPL",
    startWeek: "2025-06-09",
  });
}
