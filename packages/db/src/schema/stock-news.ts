import {
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { auditColumns } from "../utils/audit";
import { validatedStringEnum } from "./columns/validated-enum";
import { mySchema } from "./experiments";

export enum StockNewsStatus {
  Pending = "pending",
  Scraped = "scraped",
  Failed = "failed",
}

export interface StockNewsInsight {
  symbols: string[];
  sectors: string[];
  insight: string;
  impact: string; // "positive" | "negative" | "mixed" | "neutral";
}

export const stockNewsTable = mySchema.table(
  "stock_news",
  {
    id: uuid("id").primaryKey(),
    symbol: varchar("symbol", { length: 40 }).notNull(),
    url: varchar("url", { length: 2048 }).notNull(),
    originalUrl: varchar("original_url", { length: 2048 }),
    status: validatedStringEnum("status", StockNewsStatus).notNull(),
    tokenSize: integer("token_size").notNull().default(0),
    markdown: text("markdown"),
    newsDate: timestamp("news_date", { withTimezone: true }).notNull(),
    title: text("title"),
    description: text("description"),
    insights: jsonb("insights").$type<StockNewsInsight[]>().default([]),
    insightsTokenSize: integer("insights_token_size").default(0),
    ...auditColumns(),
  },
  (t) => ({
    unique: uniqueIndex("unique_symbol_url").on(t.symbol, t.url),
  }),
);
