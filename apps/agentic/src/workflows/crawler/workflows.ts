import { executeChild, proxyActivities } from "@temporalio/workflow";
import { type StockNewsSource } from "@zysk/shared";
import { StockNewsStatus } from "@zysk/shared";
import { chunk } from "lodash";

import { parseUtcDate } from "#/utils/datetime";

import { runScrapeTickerNews } from "../scraper/workflows";
import { runExtractNewsInsights } from "../stock-news/workflows";
import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 hour",
  heartbeatTimeout: "5 minute",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
    maximumAttempts: 3,
  },
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

export async function crawlNewsDomain(domain: string, date?: Date) {
  const news = await proxy.getNewsLinks(domain, date);

  await Promise.allSettled(
    chunk(news, 150).map((batch) =>
      executeChild(crawlNewsDomainBatch, {
        args: [batch],
      }),
    ),
  );
}

export async function crawlNewsSources(dateStr = "2025-09-25") {
  const sources = await proxy.getNewsSources();
  for (const batch of chunk(sources, 3)) {
    await Promise.all(
      batch.map((source) =>
        executeChild(crawlNewsDomain, {
          args: [source.url, dateStr ? parseUtcDate(dateStr) : new Date()],
        }),
      ),
    );
  }
}
