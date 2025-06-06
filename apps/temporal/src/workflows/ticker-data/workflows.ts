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

export async function syncTickerQuotesDaily(symbols: string[]) {
  const startDates = await proxy.fetchStartDatesForTimeSeries(symbols);

  for (const chunk of makeChunks(startDates, 50)) {
    await Promise.all(
      chunk.map((s) => proxy.fetchAndSaveTickerQuotes(s.symbol, s.startDate)),
    );
  }
}

export async function syncTickerQuotesForPeriod(
  symbols: string[],
  startDate: Date,
  endDate: Date,
) {
  for (const chunk of makeChunks(symbols, 50)) {
    await Promise.all(
      chunk.map((s) => proxy.fetchAndSaveTickerQuotes(s, startDate, endDate)),
    );
  }
}
