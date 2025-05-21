import {
  integer,
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

export const stockNewsTable = mySchema.table(
  "stock_news",
  {
    id: uuid("id").primaryKey(),
    symbol: varchar("symbol", { length: 40 }).notNull(),
    url: varchar("url", { length: 2048 }).notNull(),
    status: validatedStringEnum("status", StockNewsStatus).notNull(),
    tokenSize: integer("token_size").notNull().default(0),
    markdown: text("markdown"),
    newsDate: timestamp("news_date", { withTimezone: true }).notNull(),
    ...auditColumns(),
  },
  (t) => ({
    unique: uniqueIndex("unique_symbol_url").on(t.symbol, t.url),
  }),
);
