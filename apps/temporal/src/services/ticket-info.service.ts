import { db } from "../db";
import { alphaVantageService } from "./alpha-vantage.service";

export class TickerInfoService {
  async saveAVOverviews(
    data: {
      symbol: string;
      currency: string;
      country: string;
      description: string;
      sector: string;
      beta: number | null;
    }[],
  ) {
    return db
      .insertInto("app_data.alphaVantageCompanyOverviews")
      .values(data)
      .onConflict((oc) =>
        oc.columns(["symbol"]).doUpdateSet({
          sector: (eb) => eb.ref("excluded.sector"),
          description: (eb) => eb.ref("excluded.description"),
        }),
      )
      .returningAll()
      .execute();
  }

  async getAVOverviews(symbols: string[]) {
    return db
      .selectFrom("app_data.alphaVantageCompanyOverviews")
      .selectAll()
      .where("symbol", "in", symbols)
      .execute();
  }

  async getAVTimeSeries(symbol: string) {
    return db
      .selectFrom("app_data.alphaVantageTimeSeries")
      .selectAll()
      .where("symbol", "=", symbol)
      .orderBy("date", "desc")
      .limit(1)
      .executeTakeFirst();
  }

  async saveAVTimeSeries(
    data: {
      symbol: string;
      date: Date;
      openPrice: number;
      closePrice: number;
      high: number;
      low: number;
      volume: number;
    }[],
  ) {
    return db
      .insertInto("app_data.alphaVantageTimeSeries")
      .values(data)
      .execute();
  }

  async saveAVETFDetails(
    data: {
      symbol: string;
      inceptionDate: Date | undefined;
      sectors: {
        name: string;
        weight: number;
      }[];
    }[],
  ) {
    return db
      .insertInto("app_data.alphaVantageETFProfiles")
      .values(
        data.map((d) => ({
          ...d,
          inceptionDate: d.inceptionDate?.toISOString(),
        })),
      )
      .execute();
  }

  async getTimeSeries(symbol: string) {
    const data = await this.getAVTimeSeries(symbol);
    const result = await alphaVantageService.getTimeSeriesDaily(
      symbol,
      data ? "compact" : "full",
    );
    if (!result) {
      return undefined;
    }
    const quotes = data
      ? result.quotes.filter((q) => q.date > data.date)
      : result.quotes;
    return quotes;
  }
}

export const tickerInfoService = new TickerInfoService();
