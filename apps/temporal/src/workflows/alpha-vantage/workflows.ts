import { proxyActivities } from "@temporalio/workflow";
import { chunk as makeChunks } from "lodash";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "3 minutes",
  retry: {
    nonRetryableErrorTypes: ["RATE_LIMIT_EXCEEDED"],
  },
});

export async function fetchAndSaveStockOverviews(symbols: string[]) {
  for (const chunk of makeChunks(symbols, 50)) {
    const overviews = await Promise.all(
      chunk.map((s) => proxy.fetchStockDetails(s)),
    );
    await proxy.saveStockDetails(overviews.filter(Boolean));
  }
}

export async function fetchAndSaveETFDetails(symbols: string[]) {
  for (const chunk of makeChunks(symbols, 50)) {
    const details = await Promise.all(
      chunk.map((s) => proxy.fetchETFDetails(s)),
    );
    await proxy.saveETFDetails(details.filter(Boolean));
  }
}

export async function fetchAndSaveTimeSeries(symbols: string[]) {
  for (const chunk of makeChunks(symbols, 50)) {
    const details = await Promise.all(
      chunk.map((s) => proxy.fetchTimeSeries(s)),
    );
    await proxy.saveTimeSeries(details.flat().filter(Boolean));
  }
}
