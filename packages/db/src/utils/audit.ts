import { type PgTimestampConfig } from "drizzle-orm/pg-core";

import { getTimestampColumn } from "./columns";
import { updatedAt } from "./custom-types";
import { DEFAULT_NOW } from "./defaults";

interface Options {
  deletedAt?: boolean;
  camelCase?: boolean;
}

const COL_NAMES = {
  createdAt: ["created_at", "createdAt"],
  updatedAt: ["updated_at", "updatedAt"],
  deletedAt: ["deleted_at", "deletedAt"],
};

function baseAuditColumns(options?: Options) {
  const { deletedAt = false, camelCase = false } = options ?? {};
  const config: PgTimestampConfig = { withTimezone: true };

  return {
    createdAt: getTimestampColumn(COL_NAMES.createdAt[Number(camelCase)])
      .default(DEFAULT_NOW)
      .notNull(),
    updatedAt: updatedAt(COL_NAMES.updatedAt[Number(camelCase)], config)
      .default(DEFAULT_NOW)
      .notNull(),
    ...(deletedAt
      ? {
          deletedAt: getTimestampColumn(COL_NAMES.deletedAt[Number(camelCase)]),
        }
      : {}),
  };
}

export function auditColumns(options?: Omit<Options, "deletedAt">) {
  const columns = baseAuditColumns(options);
  delete columns.deletedAt;
  return columns as Omit<typeof columns, "deletedAt">;
}

export function auditColumnsWithDeletedAt(
  options?: Omit<Options, "deletedAt">,
) {
  const opts = {
    ...(options ?? {}),
    deletedAt: true,
  };
  const columns = baseAuditColumns(opts);
  if (!columns.deletedAt) {
    throw Error(
      "Unexpectedly missing deletedAt def when calling auditColumnsWithDeletedAt",
    );
  }
  return columns;
}
