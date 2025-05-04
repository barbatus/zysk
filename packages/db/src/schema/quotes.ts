import {
  date,
  numeric,
  pgTable,
  primaryKey,
  varchar,
} from "drizzle-orm/pg-core";

import { auditColumns } from "../utils/audit";

export const quotesTable = pgTable(
  "ticker_quotes",
  {
    symbol: varchar("symbol", { length: 40 }).notNull(),
    openPrice: numeric("open_price").notNull(),
    closePrice: numeric("close_price").notNull(),
    high: numeric("high").notNull(),
    low: numeric("low").notNull(),
    volume: numeric("volume").notNull(),
    splitCoeff: numeric("split_coeff"),
    divident: numeric("divident"),
    date: date("date").notNull(),
    ...auditColumns(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.symbol, table.date] }),
  }),
);

export const currentQuotesTable = pgTable("current_quotes", {
  symbol: varchar("symbol", { length: 40 }).primaryKey(),
  price: numeric("price").notNull(),
  ...auditColumns(),
});
