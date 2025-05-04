import { type PgTimestampBuilderInitial, timestamp } from "drizzle-orm/pg-core";

export function getTimestampColumn(
  name: string,
): PgTimestampBuilderInitial<string> {
  return timestamp(name, { withTimezone: true });
}
