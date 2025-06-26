import { sql } from "drizzle-orm";
import {
  boolean,
  index,
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

export enum StockNewsSentiment {
  Positive = "positive",
  Negative = "negative",
  Neutral = "neutral",
  Mixed = "mixed",
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
    symbol: varchar("symbol", { length: 80 }),
    url: varchar("url", { length: 2048 }).notNull(),
    originalUrl: varchar("original_url", { length: 2048 }),
    status: validatedStringEnum("status", StockNewsStatus).notNull(),
    tokenSize: integer("token_size").notNull().default(0),
    markdown: text("markdown"),
    newsDate: timestamp("news_date", { withTimezone: true }).notNull(),
    title: text("title"),
    description: text("description"),
    impact: validatedStringEnum("impact", StockNewsSentiment).default(
      StockNewsSentiment.Neutral,
    ),
    insights: jsonb("insights").$type<StockNewsInsight[]>().default([]),
    ...auditColumns(),
  },
  (t) => ({
    uniqueSymbolUrlIdx: uniqueIndex("unique_symbol_url").on(t.symbol, t.url),
    insightsGinIdx: index("insights_gin_idx").using(
      "gin",
      sql`insights jsonb_path_ops`,
    ),
    urlIdx: index("url_idx").on(t.url),
    originalUrlIdx: index("original_url_idx").on(t.originalUrl),
    newsDateIdx: index("news_date_idx").on(t.newsDate),
    statusIdx: index("status_idx").on(t.status),
    urlStatusIdx: index("url_status_idx").on(t.url, t.status),
  }),
);

export const newsSourcesTable = mySchema.table(
  "news_sources",
  {
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

interface InsightRefs {
  symbols: string[];
  sectors: string[];
}

export const newsInsightsTable = mySchema.table(
  "news_insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    refs: jsonb("refs").$type<InsightRefs>(),
    insight: text("insight").notNull(),
    impact: validatedStringEnum("impact", StockNewsSentiment).default(
      StockNewsSentiment.Neutral,
    ),
    longTerm: boolean("long_term").default(false),
    newsId: uuid("news_id")
      .references(() => stockNewsTable.id, {
        onDelete: "cascade",
      })
      .notNull(),
    ...auditColumns(),
  },
  (t) => ({
    insightsGinIdx: index("refs_gin_idx").using(
      "gin",
      sql`refs jsonb_path_ops`,
    ),
    insightIdx: index("insight_idx").on(t.insight),
  }),
);
