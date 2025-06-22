import {
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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

export interface NewsSourceSettings {
  maxLevelToCrawl: number;
}

export const stockNewsTable = mySchema.table(
  "stock_news",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
    ...auditColumns(),
  },
  (t) => ({
    uniqueSymbolUrlIdx: uniqueIndex("unique_symbol_url").on(t.symbol, t.url),
    insightsGinIdx: index("insights_gin_idx")
      .using("gin", sql`insights jsonb_path_ops`),
    urlIdx: index("url_idx").on(t.url),
    originalUrlIdx: index("original_url_idx").on(t.originalUrl),
    newsDateIdx: index("news_date_idx").on(t.newsDate),
    statusIdx: index("status_idx").on(t.status),
    urlStatusIdx: index("url_status_idx").on(t.url, t.status),
  }),
);

export const newsSourcesTable = mySchema.table("news_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: varchar("url", { length: 2048 }).notNull(),
  settings: jsonb("settings").$type<NewsSourceSettings>().default({
    maxLevelToCrawl: 10,
  }),
  ...auditColumns(),
  },
  (t) => ({
    uniqueUrlIdx: uniqueIndex("unique_url").on(t.url),
  }),
);
