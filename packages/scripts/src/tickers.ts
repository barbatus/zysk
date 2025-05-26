import { resolve, TickerDataService, TickerService } from "@zysk/services";
import { chunk } from "lodash";

import { getScript } from "./utils";

export const syncTickerQuotes = getScript({
  name: "sync-quotes",
  description: "Load and save last quotes for supported tickers",
})(async () => {
  const tickerService = resolve(TickerService);
  const symbols = await tickerService.getSupportedTickers();
  for await (const symbolsChunk of chunk(symbols, 20)) {
    await Promise.all(
      symbolsChunk.map((s) => tickerService.getAndSaveQuote(s)),
    );
  }
});

export const syncTickerOverviews = getScript({
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
});

export const syncTickers = getScript({
  name: "sync-tickers",
  description:
    "Load and save overviews for supported tickers (US only and for stocks and ETFs currently)",
})(async () => {
  const tickerService = resolve(TickerService);
  await tickerService.getAndSaveUSTickers();
});
