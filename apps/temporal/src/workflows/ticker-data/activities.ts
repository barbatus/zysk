import { activityInfo } from "@temporalio/activity";
import { ApplicationFailure } from "@temporalio/workflow";
import {
  RateLimitExceededError,
  resolve,
  TickerDataService,
} from "@zysk/services";
import { startOfDay, subMonths } from "date-fns";
import { isNil } from "lodash";

const tickerInfoService = resolve(TickerDataService);

export async function fetchAndSaveTickerTimeSeries(
  symbol: string,
  sinceDate: Date,
) {
  try {
    const data = await tickerInfoService.getTickerTimeSeriesApi(
      symbol,
      startOfDay(sinceDate),
    );
    await tickerInfoService.saveTickerTimeSeries(data);
  } catch (error) {
    const attempt = activityInfo().attempt;
    if (error instanceof RateLimitExceededError) {
      throw ApplicationFailure.create({
        type: "RateLimitExceeded",
        nonRetryable: false,
        message: error.message,
        nextRetryDelay: `${Math.pow(2, attempt - 1) * error.retryInSec}s`,
      });
    }
    throw error;
  }
}

export async function fetchAndSaveStockDetails(symbol: string) {
  const data = await tickerInfoService.getCompanyProfileApi(symbol);
  if (data) {
    await tickerInfoService.saveCompanyProfiles([data]);
  }
}

async function _fetchTickersToProcess(symbols: string[]) {
  const latestQuoteDate =
    await tickerInfoService.getLatestQuoteDatePerTicker(symbols);
  const sinceDates = symbols.map((symbol) =>
    isNil(latestQuoteDate[symbol])
      ? { symbol, sinceDate: subMonths(new Date(), 2) }
      : { symbol, sinceDate: latestQuoteDate[symbol].date },
  );
  return sinceDates;
}

export async function fetchTickersForTimeSeries(symbols: string[]) {
  const sinceDates = await _fetchTickersToProcess(symbols);
  return sinceDates;
}
