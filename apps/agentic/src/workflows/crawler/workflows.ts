import { executeChild, proxyActivities } from "@temporalio/workflow";
import { type StockNewsSource, StockNewsStatus } from "@zysk/db";
import { chunk } from "lodash";

import { runScrapeTickerNews } from "../scrapper/workflows";
import { runExtractNewsInsights } from "../stock-news/workflows";
import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 hour",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 3,
  },
  taskQueue: "zysk-scrapper",
});

export async function crawlNewsDomainBatch(
  batch: {
    url: string;
    newsDate: Date;
    source: StockNewsSource;
  }[],
) {
  const links = await executeChild(runScrapeTickerNews, {
    args: [{ news: batch }],
  });
  await executeChild(runExtractNewsInsights, {
    args: [
      links
        .filter((n) => n.status === StockNewsStatus.Scraped)
        .map((l) => l.id),
    ],
  });
}

export async function crawlNewsDomain(domain: string) {
  const news = await proxy.getNewsLinks(domain);

  await Promise.allSettled(
    chunk(news, 150).map((batch) =>
      executeChild(crawlNewsDomainBatch, {
        args: [batch],
      }),
    ),
  );
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
