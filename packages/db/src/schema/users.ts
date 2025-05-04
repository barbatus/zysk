import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";

import { auditColumns } from "../utils/audit";

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  ...auditColumns(),
});
