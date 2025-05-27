import { numeric, pgTable, varchar } from "drizzle-orm/pg-core";

import { auditColumns } from "../utils/audit";

export const currentQuotesTable = pgTable("current_quotes", {
  symbol: varchar("symbol", { length: 40 }).primaryKey(),
  price: numeric("price").notNull(),
  ...auditColumns(),
});
