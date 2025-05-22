import {
  date,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { auditColumns } from "#/utils/audit";

const mySchema = pgSchema("app_data");

export const companyProfiles = mySchema.table("company_profiles", {
  symbol: varchar("symbol", { length: 40 }).primaryKey(),
  description: text("description").notNull(),
  currency: varchar("currency", { length: 10 }),
  sector: text("sector").notNull(),
  country: varchar("country", { length: 10 }).notNull(),
  beta: numeric("beta"),
  ...auditColumns,
});

export const etfProfiles = mySchema.table("etf_profiles", {
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
  ...auditColumns,
});

export const tickerTimeSeries = mySchema.table(
  "ticker_time_series",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    symbol: varchar("symbol", { length: 40 }),
    openPrice: numeric("open_price").notNull(),
    closePrice: numeric("close_price").notNull(),
    high: numeric("high").notNull(),
    low: numeric("low").notNull(),
    volume: numeric("volume").notNull(),
    date: date("date").notNull(),
    ...auditColumns,
  },
  (t) => ({
    symbolDateIndex: uniqueIndex("symbol_date_index").on(t.symbol, t.date),
  }),
);
