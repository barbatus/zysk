import { activityInfo } from "@temporalio/activity";
import { ApplicationFailure } from "@temporalio/workflow";
import {
  getLogger,
  RateLimitExceededError,
  resolve,
  TickerDataService,
} from "@zysk/services";
import { endOfDay, format, startOfDay, subMonths } from "date-fns";
import { isNil } from "lodash";

const logger = getLogger();

const tickerDataService = resolve(TickerDataService);

export async function fetchAndSaveTickerQuotes(
  symbol: string,
  startDate: Date,
  endDate?: Date,
) {
  try {
    const data = await tickerDataService.getTickerTimeSeriesFromApi(
      symbol,
      startOfDay(startDate),
      endOfDay(endDate ?? new Date()),
      endDate ? "full" : "compact",
    );
    if (!data.length) {
      logger.warn(
        `[fetchAndSaveTickerQuotes] No data for ${symbol} from ${format(startDate, "yyyy-MM-dd")} to ${format(endDate ?? new Date(), "yyyy-MM-dd")}`,
      );
      return;
    }
    await tickerDataService.saveTickerTimeSeries(data);
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
  const data = await tickerDataService.getCompanyProfileApi(symbol);
  if (data) {
    await tickerDataService.saveCompanyProfiles([data]);
  }
}

export async function fetchStartDatesForTimeSeries(symbols: string[]) {
  const latestQuoteDate =
    await tickerDataService.getLatestQuoteDatePerTicker(symbols);
  const startDates = symbols.map((symbol) =>
    isNil(latestQuoteDate[symbol])
      ? { symbol, startDate: subMonths(new Date(), 2) }
      : { symbol, startDate: latestQuoteDate[symbol].date },
  );
  return startDates;
}
