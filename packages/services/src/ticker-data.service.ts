import { type DataDatabase } from "@zysk/db";
import { inject, injectable } from "inversify";
import { type Kysely } from "kysely";
import { keyBy } from "lodash";

import { AlphaVantageService } from "./alpha-vantage.service";
import { dataDBSymbol } from "./db";

@injectable()
export class TickerDataService {
  constructor(
    @inject(dataDBSymbol) private readonly db: Kysely<DataDatabase>,
    private readonly alphaVantageService: AlphaVantageService,
  ) {}

  async saveCompanyProfiles(
    data: {
      symbol: string;
      currency: string;
      country: string;
      description: string;
      sector: string;
      beta: number | null;
    }[],
  ) {
    return this.db
      .insertInto("app_data.company_profiles")
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

  async getCompanyProfiles(symbols: string[]) {
    return this.db
      .selectFrom("app_data.company_profiles")
      .selectAll()
      .where("symbol", "in", symbols)
      .execute();
  }

  async getCompanyProfileApi(symbol: string) {
    const result = await this.alphaVantageService.getSymbolOverview(symbol);
    if (!result) {
      return undefined;
    }
    return {
      symbol: result.symbol,
      description: result.Description,
      country: result.Country,
      currency: result.Currency,
      sector: result.Sector.toLowerCase(),
      beta: result.Beta,
    };
  }

  async saveTickerTimeSeries(
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
    return this.db
      .insertInto("app_data.ticker_time_series")
      .values(data)
      .onConflict((oc) =>
        oc.columns(["symbol", "date"]).doUpdateSet({
          openPrice: (eb) => eb.ref("excluded.openPrice"),
          closePrice: (eb) => eb.ref("excluded.closePrice"),
          high: (eb) => eb.ref("excluded.high"),
          low: (eb) => eb.ref("excluded.low"),
          volume: (eb) => eb.ref("excluded.volume"),
        }),
      )
      .execute();
  }

  async saveETFProfiles(
    data: {
      symbol: string;
      inceptionDate: Date | undefined;
      sectors: {
        name: string;
        weight: number;
      }[];
    }[],
  ) {
    return this.db
      .insertInto("app_data.etf_profiles")
      .values(
        data.map((d) => ({
          ...d,
          inceptionDate: d.inceptionDate?.toISOString(),
        })),
      )
      .execute();
  }

  async getLatestQuoteDatePerTicker(symbols: string[]) {
    const result = await this.db
      .selectFrom("app_data.ticker_time_series")
      .select(["symbol", (eb) => eb.fn.max("date").as("date")])
      .where("symbol", "in", symbols)
      .groupBy("symbol")
      .execute();
    return keyBy(result, "symbol");
  }

  async getSymbolTimeSeries(symbol: string, sinceDate: Date) {
    const result = await this.db
      .selectFrom("app_data.ticker_time_series")
      .selectAll()
      .where("symbol", "=", symbol)
      .where("date", ">=", sinceDate)
      .orderBy("date", "asc")
      .execute();
    return result;
  }

  async getTickerTimeSeriesApi(symbol: string, sinceDate: Date) {
    const result = await this.alphaVantageService.getTimeSeriesDaily(
      symbol,
      "compact",
    );
    if (!result) {
      return [] as Exclude<typeof result, undefined>["quotes"];
    }
    return result.quotes.filter((q) => q.date >= sinceDate);
  }
}
