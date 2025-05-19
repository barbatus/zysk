import { activityInfo } from "@temporalio/activity";
import { ApplicationFailure } from "@temporalio/workflow";
import { type InsertableStockNews } from "@zysk/db";
import {
  RateLimitExceededError,
  RequestTimeoutError,
  resolve,
  TickerNewsService,
} from "@zysk/services";
import { subDays } from "date-fns";
import { isNil } from "lodash";
// eslint-disable-next-line camelcase
import { encoding_for_model } from "tiktoken";

const tickerNewsService = resolve(TickerNewsService);

async function _fetchSymbolsToProcess(symbols: string[]) {
  const latestNewsDate =
    await tickerNewsService.getLatestNewsDatePerTicker(symbols);
  const sinceDates = symbols.map((symbol) =>
    isNil(latestNewsDate[symbol])
      ? { symbol, sinceDate: subDays(new Date(), 30) }
      : { symbol, sinceDate: latestNewsDate[symbol].newsDate },
  );
  return sinceDates;
}

export async function fetchSymbolsToProcess() {
  const symbols = ["AAPL", "TSLA", "NVDA"];
  const sinceDates = await _fetchSymbolsToProcess(symbols);
  return sinceDates;
}

export async function fetchGeneralLastNewsDate() {
  const symbols = ["GENERAL"];
  const sinceDates = await _fetchSymbolsToProcess(symbols);
  return sinceDates[0].sinceDate;
}

export async function fetchSymbolNewsByPage(symbol: string, page: number) {
  if (symbol === "GENERAL") {
    return tickerNewsService.getGeneralNewsPage(page);
  }
  return tickerNewsService.getNewsPage(symbol, page);
}

export async function scrapeSymbolNews(url: string) {
  try {
    const result = await tickerNewsService.scrapeUrl(url);
    const tokenizer = encoding_for_model("gpt-4o");
    const tokens = tokenizer.encode(result.markdown ?? "");
    return {
      ...result,
      tokenSize: tokens.length,
    };
  } catch (ex) {
    const attempt = activityInfo().attempt;
    if (ex instanceof RateLimitExceededError) {
      throw ApplicationFailure.create({
        type: "RateLimitExceeded",
        nonRetryable: false,
        message: ex.message,
        nextRetryDelay: `${Math.pow(2, attempt - 1) * ex.retryInSec}s`,
      });
    }
    if (ex instanceof RequestTimeoutError) {
      throw ApplicationFailure.create({
        type: "RequestTimeout",
        nonRetryable: attempt >= 3,
        message: ex.message,
        nextRetryDelay: `${Math.pow(2, attempt - 1) * 100}s`,
      });
    }
    throw ApplicationFailure.create({
      type: "ScapeError",
      nonRetryable: true,
      message: (ex as Error).message,
      cause: ex as Error,
    });
  }
}

export async function saveNews(news: InsertableStockNews[]) {
  return tickerNewsService.saveNews(news);
}
