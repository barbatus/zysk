import { AnyPgColumn, PgColumnBuilder, timestamp } from "drizzle-orm/pg-core";

interface CustomTypeMeta {
  isUpdatedAt?: boolean;
  isOrganizationId?: boolean;
}

const CUSTOM_COLUMN_TYPE_META_SYMBOL = Symbol.for(
  "database:CustomColumnTypeMeta",
);

export function getCustomTypeMeta(
  column: AnyPgColumn,
): CustomTypeMeta | undefined {
  return (column as any).config[CUSTOM_COLUMN_TYPE_META_SYMBOL];
}

export function getColumnIsUpdatedAt(column: AnyPgColumn) {
  return Boolean(getCustomTypeMeta(column)?.isUpdatedAt);
}

export function getColumnIsOrganizationId(column: AnyPgColumn) {
  return Boolean(getCustomTypeMeta(column)?.isOrganizationId);
}

export function setCustomTypeMeta(
  columnBuilder: PgColumnBuilder,
  meta: CustomTypeMeta,
) {
  (columnBuilder as any).config[CUSTOM_COLUMN_TYPE_META_SYMBOL] = meta;
}

type ColumnType = (...args: any[]) => PgColumnBuilder<any>;
export function createCustomTypeWithMeta<T extends ColumnType>(
  colType: ColumnType,
  meta: CustomTypeMeta,
  options?: {
    extraConfig?: (colBuilder: any) => ReturnType<T>;
  },
) {
  const { extraConfig } = options ?? {};
  return (...args: Parameters<T>): ReturnType<T> => {
    const columnBuilder = colType(...args);
    setCustomTypeMeta(columnBuilder, meta);
    return (
      extraConfig ? extraConfig(columnBuilder as ReturnType<T>) : columnBuilder
    ) as ReturnType<T>;
  };
}

export const updatedAt = createCustomTypeWithMeta<typeof timestamp>(timestamp, {
  isUpdatedAt: true,
});
