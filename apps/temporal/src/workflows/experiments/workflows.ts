import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 3,
  },
});

export async function runPredictionExperiment() {
  return proxy.runPredictionExperiment();
}
