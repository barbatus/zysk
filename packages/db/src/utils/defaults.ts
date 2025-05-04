import { sql } from "drizzle-orm";

/**
 * Use this instead of now() (or drizzle's .defaultNow()) as it ensures
 * the same value for all records inserted in the same transaction.
 */
export const DEFAULT_NOW = sql`current_timestamp`;

export const DEFAULT_DATERANGE = sql`'(,)'`;

export const DEFAULT_ENCRYPTED_JSONB = sql`''`;
