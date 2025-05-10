import { tickerNewsService } from "#/services/ticker-news.service";

export async function getSymbolsToProcess() {
  return ["AAPL", "NVDA"];
}

export async function fetchSymbolNewsByPage(symbol: string, page: number) {
  return tickerNewsService.getNewsPage(symbol, page);
}

export async function scrapeSymbolNews(urls: string[]) {
  return Promise.all(urls.map((url) => tickerNewsService.scrapeUrl(url)));
}
