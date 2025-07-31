import { executeChild, proxyActivities } from "@temporalio/workflow";
import { chunk } from "lodash";

import { runScrapeTickerNews } from "../scrapper/workflows";
import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 hour",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 3,
  },
  taskQueue: "zysk-scrapper",
});

export async function crawlNewsDomain(domain: string) {
  const news = await proxy.getNewsLinks(domain);
  await executeChild(runScrapeTickerNews, {
    args: [
      {
        news,
      },
    ],
  });
}

export async function crawlNewsSources() {
  const sources = await proxy.getNewsSources();
  for (const batch of chunk(sources, 3)) {
    await Promise.all(
      batch.map((source) =>
        executeChild(crawlNewsDomain, {
          args: [source.url],
        }),
      ),
    );
  }
}
