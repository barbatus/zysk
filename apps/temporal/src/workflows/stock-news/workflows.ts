import { executeChild, proxyActivities } from "@temporalio/workflow";
import { startOfDay, subDays } from "date-fns";
import { chunk as makeChunks, mapKeys } from "lodash";

import type * as activities from "./activities";

const proxy = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: {
    nonRetryableErrorTypes: ["NonRetryable"],
  },
});

type SymbolNews = Awaited<
  ReturnType<typeof proxy.fetchSymbolNewsByPage>
>[number];
export async function scrapeSymbolNews(symbol: string, sinceDate: Date) {
  const fetchNewsSince = async (page: number) => {
    const news = await proxy
      .fetchSymbolNewsByPage(symbol, page)
      .then((n) => n.filter((a) => a.newsDate >= sinceDate));
    if (news.length === 0) {
      return [];
    }

    return news;
  };

  let page = 1;
  let currentNews: SymbolNews[] = [];
  let hasMore = true;
  while (hasMore) {
    currentNews = await fetchNewsSince(page);
    const scrapedNews: (Omit<SymbolNews, "title"> & {
      markdown: string;
    })[] = [];
    const newsDateMap = mapKeys(currentNews, "url");
    for (let i = 0; i < currentNews.length; i += 100) {
      const tmpScrape = await Promise.all(
        makeChunks(currentNews.slice(i, i + 100), 50).map((chunk) =>
          proxy.scrapeSymbolNews(chunk.map((n) => n.url)),
        ),
      );
      scrapedNews.push(
        ...tmpScrape
          .flat()
          .map((n) =>
            n.markdown
              ? {
                  ...n,
                  markdown: n.markdown,
                  newsDate: newsDateMap[n.url].newsDate,
                }
              : null,
          )
          .filter(Boolean),
      );
    }
    // TODO: Save scraped news
    hasMore = currentNews.length > 0;
    page += 1;
  }
}

export async function scrapeNews() {
  const symbols = await proxy.getSymbolsToProcess();

  const sinceDate = startOfDay(subDays(new Date(), 5));
  for (const symbol of symbols) {
    await executeChild(scrapeSymbolNews, {
      args: [symbol, sinceDate],
    });
  }
}
