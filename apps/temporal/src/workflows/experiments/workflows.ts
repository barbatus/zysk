import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "7 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 1,
  },
});

export async function runPredictionExperiment(_symbol: string) {
  const newsBatches = await proxy.fetchLastWeekNews({
    symbol: "AAPL",
  });

  const results = await Promise.all(
    newsBatches.map((batch) =>
      proxy.runPredictionExperiment({
        symbol: "AAPL",
        newsIds: batch,
      }),
    ),
  );
  console.log(results);
}
