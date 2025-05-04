import {
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { auditColumns } from "../utils/audit";
import { validatedStringEnum } from "./columns/validated-enum";
import { usersTable } from "./users";

enum TickerType {
  Stock = "stock",
  ETP = "etp",
  REIT = "reit",
  ADR = "adr",
}

export const tickersTable = pgTable("tickers", {
  symbol: varchar("symbol", { length: 40 }).notNull().primaryKey(),
  type: validatedStringEnum("type", TickerType),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  figi: varchar("figi", { length: 20 }),
  about: text("about"),
  sectors: jsonb("sectors")
    .default([])
    .$type<
      {
        name: string;
        weight: number;
      }[]
    >()
    .default([]),
  foundedAt: timestamp("founded_at", { withTimezone: true }),
});

export const userTickersTable = pgTable("user_tickers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  symbol: varchar("symbol", { length: 40 })
    .notNull()
    .references(() => tickersTable.symbol, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  amount: numeric("amount").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
  openPrice: numeric("open_price"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closePrice: numeric("close_price"),
  ...auditColumns(),
});
