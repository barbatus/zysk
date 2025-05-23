import { activityInfo } from "@temporalio/activity";
import { ApplicationFailure } from "@temporalio/workflow";
import { type StockNewsUpdate } from "@zysk/db";
import {
  RateLimitExceededError,
  RequestTimeoutError,
  resolve,
  TickerNewsService,
} from "@zysk/services";
import { addDays, startOfDay, subDays } from "date-fns";
import { isNil } from "lodash";
// eslint-disable-next-line camelcase
import { encoding_for_model } from "tiktoken";

const tickerNewsService = resolve(TickerNewsService);

async function _fetchTickersToProcess(symbols: string[]) {
  const latestNewsDate =
    await tickerNewsService.getLatestNewsDatePerTicker(symbols);
  const lastMonth = subDays(new Date(), 30);
  const startOfDay_ = (date: Date) => startOfDay(date);
  const sinceDates = symbols.map((symbol) =>
    isNil(latestNewsDate[symbol])
      ? { symbol, sinceDate: startOfDay_(lastMonth) }
      : {
          symbol,
          sinceDate: startOfDay_(addDays(latestNewsDate[symbol].newsDate, 1)),
        },
  );
  return sinceDates;
}

export async function fetchTickersForNews(symbols: string[]) {
  const sinceDates = await _fetchTickersToProcess(symbols);
  return sinceDates;
}

export async function fetchGeneralMarketLastNewsDate() {
  const sinceDates = await _fetchTickersToProcess(["GENERAL"]);
  return sinceDates[0].sinceDate;
}

export async function fetchSymbolNewsByPage(symbol: string, sinceDate: Date) {
  if (symbol === "GENERAL") {
    return tickerNewsService.getGeneralNewsPage(sinceDate);
  }
  return tickerNewsService.getTickerNews(symbol, sinceDate);
}

export async function scrapeSymbolNews(url: string) {
  try {
    const result = await tickerNewsService.scrapeUrl(url, 180);
    const tokenizer = encoding_for_model("gpt-4o");
    const tokens = tokenizer.encode(result.markdown ?? "");
    return {
      ...result,
      url: result.url || url,
      originalUrl: url,
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

export async function saveNews(news: StockNewsUpdate[]) {
  return tickerNewsService.saveNews(news);
}
