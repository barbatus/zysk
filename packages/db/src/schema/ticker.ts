import {
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { validatedStringEnum } from "./columns/validated-enum";
import { userTable } from "./user";

enum TickerType {
  Stock = "stock",
  ETP = "etp",
  REIT = "reit",
  ADR = "adr",
}

export const tickerTable = pgTable("ticker", {
  symbol: varchar("symbol", { length: 10 }).notNull().primaryKey(),
  type: validatedStringEnum("type", TickerType),
  currency: varchar("currency", { length: 10 }).notNull(),
  figi: varchar("figi", { length: 12 }).notNull(),
  about: text("about"),
  sectors: jsonb("sectors").$type<
    {
      name: string;
      weight: number;
    }[]
  >(),
  foundedAt: timestamp("founded_at", { withTimezone: true }),
});

export const userTickersTable = pgTable(
  "user_tickers",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => userTable.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    symbol: varchar("symbol", { length: 10 })
      .notNull()
      .references(() => tickerTable.symbol, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    amount: numeric("amount"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    openPrice: numeric("open_price"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closePrice: numeric("close_price"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.symbol] }),
  }),
);
