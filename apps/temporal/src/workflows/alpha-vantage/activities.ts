import { alphaVantageService } from "#/services/alpha-vantage.service";
import { tickerInfoService } from "#/services/ticket-info.service";

export async function fetchStockDetails(symbol: string) {
  return alphaVantageService.getSymbolOverview(symbol);
}

export async function fetchETFDetails(symbol: string) {
  return alphaVantageService.getETFProfile(symbol);
}

export async function fetchTimeSeries(symbol: string) {
  return tickerInfoService.getTimeSeries(symbol);
}

export async function getStockDetails(symbols: string[]) {
  return tickerInfoService.getAVOverviews(symbols);
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
  await tickerInfoService.saveAVOverviews(saveValues);
  return saveValues;
}

type ETFType = Awaited<ReturnType<typeof fetchETFDetails>>;
export async function saveETFDetails(data: Exclude<ETFType, undefined>[]) {
  const saveValues = data.map((d) => ({
    symbol: d.symbol,
    inceptionDate: d.inception_date ? new Date(d.inception_date) : undefined,
    sectors: d.sectors,
  }));
  await tickerInfoService.saveAVETFDetails(saveValues);
  return saveValues;
}

type TimeSeriesType = Awaited<ReturnType<typeof fetchTimeSeries>>;
export async function saveTimeSeries(data: Exclude<TimeSeriesType, undefined>) {
  return tickerInfoService.saveAVTimeSeries(data);
}
