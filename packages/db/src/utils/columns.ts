import { timestamp } from "drizzle-orm/pg-core";

export function getTimestampColumn(name: string) {
  return timestamp(name, { withTimezone: true });
}
