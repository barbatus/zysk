import { executeChild, proxyActivities } from "@temporalio/workflow";

import { scrapeAllNews } from "../stock-news/workflows";
import { fetchTickersTimeSeries } from "../ticker-data/workflows";
import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "7 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 2,
  },
});

export async function runTickerPredictionExperiment(symbol: string) {
  const { newsBatchIds, timeSeries } =
    await proxy.fetchSymbolNextWeekPredictionExperimentData({
      symbol,
    });

  const predictions = await Promise.all(
    newsBatchIds.map((newsBatchId) =>
      proxy.runNextWeekTickerPredictionExperiment({
        symbol,
        newsIds: newsBatchId,
        timeSeries,
      }),
    ),
  );

  return proxy.makePredictions({
    symbol,
    predictions,
  });
}

export async function runMarketPredictionExperiment() {
  const newsBatches = await proxy.fetchLastWeekNews({
    symbol: "GENERAL",
  });

  const predictions = await Promise.all(
    newsBatches.map((batch) =>
      proxy.runNextWeekMarketPredictionExperiment({
        newsIds: batch,
      }),
    ),
  );

  return proxy.makePredictions({
    symbol: "GENERAL",
    predictions,
  });
}

export async function runTickersPredictionExperiments(symbols: string[]) {
  await Promise.all(
    symbols.map((symbol) => runTickerPredictionExperiment(symbol)),
  );
}

export async function runAllTogetherExperiment(onlyTickers = false) {
  const symbols = await proxy.getSupportedTickers();

  if (!onlyTickers) {
    await Promise.all([
      executeChild(fetchTickersTimeSeries, {
        args: [symbols],
      }),
      executeChild(scrapeAllNews, {
        args: [symbols],
      }),
    ]);
    await executeChild(runMarketPredictionExperiment);
  }

  await runTickersPredictionExperiments(symbols);
}
