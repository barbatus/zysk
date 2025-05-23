import { proxyActivities } from "@temporalio/workflow";
import { chunk as makeChunks } from "lodash";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 3,
  },
});

export async function fetchTickersTimeSeries(symbols: string[]) {
  const sinceDates = await proxy.fetchTickersForTimeSeries(symbols);

  for (const chunk of makeChunks(sinceDates, 50)) {
    await Promise.all(
      chunk.map((s) =>
        proxy.fetchAndSaveTickerTimeSeries(s.symbol, s.sinceDate),
      ),
    );
  }
}
