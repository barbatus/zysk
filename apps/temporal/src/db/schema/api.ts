import {
  date,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

const mySchema = pgSchema("app_data");

export const alphaVantageCompanyOverview = mySchema.table(
  "alpha_vantage_company_overviews",
  {
    symbol: varchar("symbol", { length: 40 }).primaryKey(),
    description: text("description").notNull(),
    currency: varchar("currency", { length: 10 }),
    sector: text("sector").notNull(),
    country: varchar("country", { length: 10 }).notNull(),
    beta: numeric("beta"),
  },
);

export const alphaVantageETFProfile = mySchema.table(
  "alpha_vantage_etf_profiles",
  {
    symbol: varchar("symbol", { length: 40 }).primaryKey(),
    sectors: jsonb("sectors").default([]).$type<
      {
        name: string;
        weight: number;
      }[]
    >(),
    holdings: jsonb("holdings").default([]).$type<
      {
        symbol: string;
        description: string;
        weight: number;
      }[]
    >(),
    inceptionDate: timestamp("inception_date", { withTimezone: true }),
  },
);

export const alphaVantagaTimeSeries = mySchema.table(
  "alpha_vantage_time_series",
  {
    symbol: varchar("symbol", { length: 40 }).primaryKey(),
    openPrice: numeric("open_price").notNull(),
    closePrice: numeric("close_price").notNull(),
    high: numeric("high").notNull(),
    low: numeric("low").notNull(),
    volume: numeric("volume").notNull(),
    date: date("date").notNull(),
  },
);
