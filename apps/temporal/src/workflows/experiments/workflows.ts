import { executeChild, proxyActivities } from "@temporalio/workflow";

import { syncAllNewsDaily } from "../stock-news/workflows";
import { syncTickerQuotesDaily, syncTickerQuotesForPeriod } from "../ticker-data/workflows";
import type * as activities from "./activities";
import { startOfWeek, subDays, addDays, parse } from "date-fns";
import { syncMarketNewsForPeriod, syncTickerNewsForPeriod } from "../stock-news/workflows";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 minutes",
  heartbeatTimeout: "10 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 2,
  },
});

export async function runTickerSentimentPredictionExperiment(symbol: string, startDate: Date) {
  const { newsBatchIds, timeSeries } =
    await proxy.fetchSentimentPredictionExperimentData({
      symbol,
      startDate,
    });

  const predictions = await Promise.all(
    newsBatchIds.map((newsBatchId) =>
      proxy.runTickerSentimentPredictionExperiment({
        symbol,
        newsIds: newsBatchId,
        timeSeries,
        period: startDate,
      }),
    ),
  );

  return proxy.makePredictions({
    symbol,
    predictions,
    period: startDate,
  });
}

export async function runMarketSentimentPredictionExperiment(startDate: Date) {
  const newsBatches = await proxy.fetchNewsForPeriod({
    symbol: "GENERAL",
    startDate,
    endDate: addDays(startDate, 7),
  });

  const predictions = await Promise.all(
    newsBatches.map((batch) =>
      proxy.runMarketSentimentPredictionExperiment({
        newsIds: batch,
      }),
    ),
  );

  return proxy.makePredictions({
    symbol: "GENERAL",
    predictions,
    period: startDate,
  });
}

export async function runTickerSentimentPredictionExperiments(
  symbols: string[],
  startDate: Date,
) {
  await Promise.all(
    symbols.map((symbol) => runTickerSentimentPredictionExperiment(symbol, startDate)),
  );
}

export async function predictLatestSentiments(withMarketSentiment = false) {
  const symbols = await proxy.getSupportedTickers();

  const startDate = startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 });

  await executeChild(syncTickerQuotesDaily, {
    args: [symbols],
  });

  if (withMarketSentiment) {
    await executeChild(syncAllNewsDaily, {
      args: [symbols],
    });
    await executeChild(runMarketSentimentPredictionExperiment, {
      args: [startDate],
    });
  }

  await runTickerSentimentPredictionExperiments(symbols, startDate);
}

export async function predictTickerSentimentForPeriod(params: { symbol: string, startWeek: string }) {
  const { symbol, startWeek } = params;

  const startWeekDate = parse(startWeek, "yyyy-MM-dd", new Date());
  const startDate = startOfWeek(subDays(startWeek, 7), { weekStartsOn: 1 });

  await Promise.all([
    executeChild(syncTickerQuotesForPeriod, {
      args: [[symbol], subDays(startDate, 7), addDays(startDate, 14)],
    }),
    executeChild(syncMarketNewsForPeriod, {
      args: [startDate, addDays(startDate, 7)],
    }),
    executeChild(syncTickerNewsForPeriod, {
      args: [symbol, startDate, addDays(startDate, 7)],
    }),
  ]);
  await executeChild(runMarketSentimentPredictionExperiment, {
    args: [startWeekDate],
  });

  await runTickerSentimentPredictionExperiments([symbol], startWeekDate);
}
