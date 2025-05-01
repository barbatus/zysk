import { proxyActivities } from "@temporalio/workflow";

import type * as finnhub from "./finnhub/activities";

export * from "./alpha-vantage/workflows";

const proxy = proxyActivities<typeof finnhub>({
  startToCloseTimeout: "5 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 3,
  },
});

export async function fetchProfiles(symbols: string[]) {
  const result = await proxy.fetchUSSymbols(symbols);
  console.log(result);
  // const stocks = result
  //   .filter((r) => r.type === "Common Stock")
  //   .map((r) => r.symbol);
  // const etfs = result.filter((r) => r.type === "ETP").map((r) => r.symbol);
  // await Promise.all([
  //   // executeChild(alphaVantage.fetchAndSaveStockOverviews, {
  //   //   args: [stocks],
  //   // }),
  //   // executeChild(alphaVantage.fetchAndSaveETFDetails, {
  //   //   args: [etfs],
  //   // }),
  //   // executeChild(alphaVantage.fetchAndSaveTimeSeries, {
  //   //   args: [result.map((r) => r.symbol)],
  //   // }),
  // ]);
}
