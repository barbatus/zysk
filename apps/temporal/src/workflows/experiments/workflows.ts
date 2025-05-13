import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "7 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 1,
  },
});

export async function runPredictionExperiment(symbol: string) {
  const newsBatches = await proxy.fetchLastWeekNews({
    symbol,
  });

  const predictions = await Promise.all(
    newsBatches.map((batch) =>
      proxy.runShortTermMarketPredictionExperiment({
        symbol,
        newsIds: batch,
      }),
    ),
  );

  await proxy.mergePredictions({
    predictions,
  });
}

export async function runPredictionExperiments() {
  const symbols = ["AAPL", "TSLA", "NVDA"];
  await Promise.all(symbols.map(runPredictionExperiment));
}
