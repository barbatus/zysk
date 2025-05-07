import {
  getETFProfile,
  getSymbolOverview,
  getTimeSeriesDaily,
} from "#/api/alpha-vantage";
import { stockApiService } from "#/services/stock-api.service";

export async function fetchStockDetails(symbol: string) {
  return getSymbolOverview(symbol);
}

export async function fetchETFDetails(symbol: string) {
  return getETFProfile(symbol);
}

export async function fetchTimeSeries(symbol: string) {
  const data = await stockApiService.getAVTimeSeries(symbol);
  const result = await getTimeSeriesDaily(symbol, data ? "compact" : "full");
  if (!result) {
    return undefined;
  }
  const quotes = data
    ? result.quotes.filter((q) => q.date > data.date)
    : result.quotes;
  return quotes;
}

export async function getStockDetails(symbols: string[]) {
  return stockApiService.getAVOverviews(symbols);
}

type StockType = Awaited<ReturnType<typeof fetchStockDetails>>;
export async function saveStockDetails(data: Exclude<StockType, undefined>[]) {
  const saveValues = data.map((d) => ({
    symbol: d.symbol,
    description: d.Description,
    country: d.Country,
    currency: d.Currency,
    sector: d.Sector.toLowerCase(),
    beta: d.Beta,
  }));
  await stockApiService.saveAVOverviews(saveValues);
  return saveValues;
}

type ETFType = Awaited<ReturnType<typeof fetchETFDetails>>;
export async function saveETFDetails(data: Exclude<ETFType, undefined>[]) {
  const saveValues = data.map((d) => ({
    symbol: d.symbol,
    inceptionDate: d.inception_date ? new Date(d.inception_date) : undefined,
    sectors: d.sectors,
  }));
  await stockApiService.saveAVETFDetails(saveValues);
  return saveValues;
}

type TimeSeriesType = Awaited<ReturnType<typeof fetchTimeSeries>>;
export async function saveTimeSeries(data: Exclude<TimeSeriesType, undefined>) {
  return stockApiService.saveAVTimeSeries(data);
}
