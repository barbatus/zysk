import { subDays } from "date-fns";
import { isNil } from "lodash";
// eslint-disable-next-line camelcase
import { encoding_for_model } from "tiktoken";

import { type StockNews } from "#/db/schema/kysely";
import { tickerNewsService } from "#/services/ticker-news.service";

export async function fetchSymbolsToProcess() {
  const latestNewsDate = await tickerNewsService.getLatestNewsDatePerTicker();
  const symbols = Object.keys(latestNewsDate);
  const sinceDates = symbols.map((symbol) =>
    isNil(latestNewsDate[symbol])
      ? { symbol, sinceDate: subDays(new Date(), 30) }
      : { symbol, sinceDate: latestNewsDate[symbol].newsDate },
  );
  return sinceDates;
}

export async function fetchSymbolNewsByPage(symbol: string, page: number) {
  return tickerNewsService.getNewsPage(symbol, page);
}

export async function scrapeSymbolNews(urls: string[]) {
  const data = await Promise.all(
    urls.map((url) => tickerNewsService.scrapeUrl(url)),
  );

  const tokenizer = encoding_for_model("gpt-4o");
  return data.map((d) => {
    const tokens = tokenizer.encode(d.markdown ?? "");
    return {
      ...d,
      tokenSize: tokens.length,
    };
  });
}

export async function saveNews(news: StockNews[]) {
  return tickerNewsService.saveNews(
    news.map((n) => ({
      ...n,
      newsDate: new Date(n.newsDate),
    })),
  );
}
