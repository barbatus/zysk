import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
});

export async function fetchUSSymbols(symbols: string[]) {
  return proxy.fetchUSSymbols(symbols);
}
