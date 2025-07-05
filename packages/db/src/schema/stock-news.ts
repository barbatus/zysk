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
import { experimentsTable, mySchema } from "./experiments";

export enum StockNewsStatus {
  Pending = "pending",
  Scraped = "scraped",
  InsightsExtracted = "insights_extracted",
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
    originalUrl: varchar("original_url", { length: 2048 }).notNull(),
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
    experiementId: uuid("experiement_id").references(() => experimentsTable.id),
    ...auditColumns(),
  },
  (t) => ({
    insightsGinIdx: index("insights_gin_idx").using(
      "gin",
      sql`insights jsonb_path_ops`,
    ),
    symbolUrlIdx: uniqueIndex("symbol_url_idx").on(t.symbol, t.url),
    experiementIdIdx: index("experiement_id_idx").on(t.experiementId),
    symbolOriginalUrlIdx: uniqueIndex("symbol_original_url_idx").on(
      t.symbol,
      t.originalUrl,
    ),
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
    newsTitle: text("news_title").notNull(),
    url: varchar("url", { length: 2048 }).notNull(),
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
