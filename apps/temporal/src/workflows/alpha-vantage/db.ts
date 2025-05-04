import { db } from "../../db";

export async function saveAVOverviews(
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

export async function getAVOverviews(symbols: string[]) {
  return db
    .selectFrom("app_data.alphaVantageCompanyOverviews")
    .selectAll()
    .where("symbol", "in", symbols)
    .execute();
}

export async function getAVTimeSeries(symbol: string) {
  return db
    .selectFrom("app_data.alphaVantageTimeSeries")
    .selectAll()
    .where("symbol", "=", symbol)
    .orderBy("date", "desc")
    .limit(1)
    .executeTakeFirst();
}

export async function saveAVTimeSeries(
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

export async function saveAVETFDetails(
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
    .values(data)
    .execute();
}
