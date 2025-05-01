import "dotenv/config";

import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import { type Database } from "./schema/kysely";

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  }),
});

export const db = new Kysely<Database>({
  dialect,
  plugins: [new CamelCasePlugin()],
});

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
    .insertInto("api_data.alphaVantageCompanyOverview")
    .values(data)
    .onConflict((oc) =>
      oc.columns(["symbol"]).doUpdateSet({
        sector: (eb) => eb.ref("excluded.sector"),
        description: (eb) => eb.ref("excluded.description"),
      }),
    )
    .execute();
}

export async function getAVOverviews(symbols: string[]) {
  return db
    .selectFrom("api_data.alphaVantageCompanyOverview")
    .selectAll()
    .where("symbol", "in", symbols)
    .execute();
}

export async function getAVTimeSeries(symbol: string) {
  return db
    .selectFrom("api_data.alphaVantageTimeSeries")
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
    .insertInto("api_data.alphaVantageTimeSeries")
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
  console.log(data);
  return db
    .insertInto("api_data.alphaVantageEtfProfile")
    .values(data)
    .execute();
}
