import { executeChild, proxyActivities } from "@temporalio/workflow";

import { scrapeAllNewsDaily } from "../stock-news/workflows";
import { fetchTickersTimeSeries } from "../ticker-data/workflows";
import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 minutes",
  heartbeatTimeout: "5 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 2,
  },
});

export async function runTickerSentimentPredictionExperiment(symbol: string) {
  const { newsBatchIds, timeSeries } =
    await proxy.fetchSymbolNSentimentPredictionExperimentData({
      symbol,
    });

  const predictions = await Promise.all(
    newsBatchIds.map((newsBatchId) =>
      proxy.runTickerSentimentPredictionExperiment({
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

export async function runMarketSentimentPredictionExperiment() {
  const newsBatches = await proxy.fetchLastWeekNews({
    symbol: "GENERAL",
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
  });
}

export async function runTickersSentimentPredictionExperiments(
  symbols: string[],
) {
  await Promise.all(
    symbols.map((symbol) => runTickerSentimentPredictionExperiment(symbol)),
  );
}

export async function runAllTogetherExperiment(onlyTickers = true) {
  const symbols = await proxy.getSupportedTickers();

  if (!onlyTickers) {
    await Promise.all([
      executeChild(fetchTickersTimeSeries, {
        args: [symbols],
      }),
      executeChild(scrapeAllNewsDaily, {
        args: [symbols],
      }),
    ]);
    await executeChild(runMarketSentimentPredictionExperiment);
  }

  await runTickersSentimentPredictionExperiments(symbols);
}
