import { type DataDatabase } from "@zysk/db";
import { inject, injectable } from "inversify";
import { type Kysely, sql } from "kysely";
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
    const result = await this.alphaVantageService.fetchCompanyOverview(symbol);
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

  async getAndSaveCompanyOverview(symbol: string) {
    const overview = await this.getCompanyProfileApi(symbol);
    if (overview) {
      await this.saveCompanyProfiles([overview]);
      return true;
    }
    return false;
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
          updatedAt: new Date(),
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

  async getTickerTimeSeries(params: {
    symbols?: string[];
    startDate: Date;
    endDate?: Date;
  }) {
    const { symbols, startDate, endDate } = params;
    const result = await this.db
      .selectFrom("app_data.ticker_time_series")
      .selectAll()
      .where("date", ">=", startDate)
      .$if(Boolean(symbols), (eb) => eb.where("symbol", "in", symbols!))
      .$if(Boolean(endDate), (eb) => eb.where("date", "<", endDate!))
      .orderBy("date", "asc")
      .execute();
    return result;
  }

  async getTickerTimeSeriesFromApi(
    symbol: string,
    startDate: Date,
    endDate: Date,
    outputsize: "full" | "compact" = "compact",
  ) {
    const result = await this.alphaVantageService.fetchTimeSeriesDaily(
      symbol,
      outputsize,
    );
    if (!result) {
      return [] as Exclude<typeof result, undefined>["quotes"];
    }
    return result.quotes.filter((q) => q.date >= startDate && q.date < endDate);
  }

  async getAndSaveTickerTimeSeries(
    symbol: string,
    startDate: Date,
    endDate: Date,
    outputsize: "full" | "compact" = "compact",
  ) {
    const result = await this.getTickerTimeSeriesFromApi(
      symbol,
      startDate,
      endDate,
      outputsize,
    );
    await this.saveTickerTimeSeries(result);
  }

  async getWeeklyOpenClosePrices(
    symbols: string[],
    startDate: Date,
    endDate?: Date,
  ) {
    const result = await this.db
      .selectFrom("app_data.ticker_time_series")
      .select(() => [
        sql<Date>`date_trunc('week', date)`.as("weekStart"),
        sql<string>`symbol`.as("symbol"),
        sql<number>`first_value("open_price") over (partition by symbol, date_trunc('week', date) order by date asc)`.as(
          "open",
        ),
        sql<number>`last_value("close_price") over (partition by symbol, date_trunc('week', date) order by date asc
        rows between unbounded preceding and unbounded following)`.as("close"),
      ])
      .distinct()
      .where("date", ">=", startDate)
      .where("symbol", "in", symbols)
      .$if(Boolean(endDate), (eb) => eb.where("date", "<", endDate!))
      .execute();
    return result;
  }
}
