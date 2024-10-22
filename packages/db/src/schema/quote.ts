import {
  date,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const quoteTable = pgTable(
  "quote",
  {
    symbol: varchar("symbol", { length: 10 }).notNull(),
    open_price: numeric("open_price").notNull(),
    close_price: numeric("close_price").notNull(),
    high: numeric("high").notNull(),
    low: numeric("low").notNull(),
    volume: numeric("volume").notNull(),
    split_coeff: numeric("split_coeff"),
    divident: numeric("divident"),
    date: date("date").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.symbol, table.date] }),
  }),
);

export const rtQuoteTable = pgTable("rl_quote", {
  symbol: varchar("symbol", { length: 10 }).primaryKey(),
  price: numeric("price").notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});
