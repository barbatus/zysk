import {
  resolve,
  TickerDataService,
  TickerNewsService,
  TickerService,
} from "@zysk/services";
import { Argument } from "commander";
import { subYears } from "date-fns";
import { chunk } from "lodash";

import { NEWS_SOURCES, SECTORS, SUPPORTED_TICKERS } from "./defaults";
import { createScript } from "./utils";

export const syncTickerQuotes = createScript<[]>({
  name: "sync-current-quote",
  description: "Load and save last quotes for supported tickers",
})(async () => {
  const tickerService = resolve(TickerService);
  const symbols = await tickerService.getSupportedTickers();
  for await (const symbolsChunk of chunk(symbols, 20)) {
    await Promise.all(
      symbolsChunk.map((s) => tickerService.fetchAndSaveQuote(s)),
    );
  }
  return "OK";
});

export const syncTickerOverviews = createScript<[]>({
  name: "sync-ticker-overviews",
  description: "Load and save overviews for supported tickers",
})(async () => {
  const tickerDataService = resolve(TickerDataService);
  const tickerService = resolve(TickerService);
  const symbols = await tickerService.getSupportedTickers();
  for await (const symbolsChunk of chunk(symbols, 20)) {
    await Promise.all(
      symbolsChunk.map((s) => tickerDataService.getAndSaveCompanyOverview(s)),
    );
  }
  return "OK";
});

export const syncTickers = createScript({
  name: "sync-tickers",
  description:
    "Load and save overviews for supported tickers (US only and for stocks and ETFs currently)",
})(async () => {
  const tickerService = resolve(TickerService);
  await tickerService.fetchUSTickersFromApiAndSave(SUPPORTED_TICKERS);
  return "OK";
});

export const syncTickerTimeSeries = createScript<[]>({
  name: "sync-ticker-time-series",
  description:
    "Load and save time series for supported tickers for last 5 years",
})(async () => {
  const tickerDataService = resolve(TickerDataService);
  const tickerService = resolve(TickerService);
  const symbols = await tickerService.getSupportedTickers();
  const lastFiveYears = subYears(new Date(), 5);
  for await (const symbolsChunk of chunk(symbols, 20)) {
    await Promise.all(
      symbolsChunk.map((s) =>
        tickerDataService.getAndSaveTickerTimeSeries(
          s,
          lastFiveYears,
          new Date(),
          "full",
        ),
      ),
    );
  }
  return "OK";
});

export const syncSupportedTickers = createScript<[]>({
  name: "sync-supported-tickers",
  description: "Update supported tickers",
})(async () => {
  const tickerService = resolve(TickerService);
  await tickerService.updateSupportedTickers(SUPPORTED_TICKERS);
  return "OK";
});

export const syncTickerSectors = createScript<[]>({
  name: "sync-ticker-sectors",
  description: "Update sectors for supported tickers",
})(async () => {
  const tickerService = resolve(TickerService);
  await tickerService.fetchAndSaveSectors();
  return "OK";
});

export const scrapeUrl = createScript<[string]>({
  name: "scrape-url",
  description: "Scrape URL",
  arguments: [new Argument("url", "URL to scrape").argRequired()],
})(async (url) => {
  const tickerNewsService = resolve(TickerNewsService);
  return await tickerNewsService.scrapeUrls({ urls: [url] });
});

export const syncNewsSources = createScript<[]>({
  name: "sync-news-sources",
  description: "Sync news sources",
})(async () => {
  const tickerNewsService = resolve(TickerNewsService);
  await tickerNewsService.saveNewsSources(NEWS_SOURCES);
  return "OK";
});

export const syncSectors = createScript<[]>({
  name: "sync-sectors",
  description: "Sync sectors",
})(async () => {
  const tickerService = resolve(TickerService);
  await tickerService.updateSectors(SECTORS);
  return "OK";
});
