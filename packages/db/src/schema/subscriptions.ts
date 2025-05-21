import { boolean, index, pgTable, uuid, varchar } from "drizzle-orm/pg-core";

import { auditColumns } from "../utils/audit";
import { usersTable } from "./users";

export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => usersTable.id)
      .notNull(),
    symbol: varchar("symbol", { length: 255 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...auditColumns(),
  },
  (t) => ({
    userSymbolIdx: index("user_symbol_idx").on(t.userId, t.symbol),
  }),
);
