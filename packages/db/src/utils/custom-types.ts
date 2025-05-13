import {
  type AnyPgColumn,
  type PgColumnBuilder,
  type PgTimestampBuilderInitial,
  timestamp,
} from "drizzle-orm/pg-core";

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
  const data = column as unknown as {
    config: { [CUSTOM_COLUMN_TYPE_META_SYMBOL]: CustomTypeMeta };
  };
  return data.config[CUSTOM_COLUMN_TYPE_META_SYMBOL];
}

export function getColumnIsUpdatedAt(column: AnyPgColumn) {
  return Boolean(getCustomTypeMeta(column)?.isUpdatedAt);
}

export function getColumnIsOrganizationId(column: AnyPgColumn) {
  return Boolean(getCustomTypeMeta(column)?.isOrganizationId);
}

export function setCustomTypeMeta(
  columnBuilder: PgColumnBuilder | PgTimestampBuilderInitial<string>,
  meta: CustomTypeMeta,
) {
  (
    columnBuilder as unknown as {
      config: { [CUSTOM_COLUMN_TYPE_META_SYMBOL]: CustomTypeMeta };
    }
  ).config[CUSTOM_COLUMN_TYPE_META_SYMBOL] = meta;
}

type ColumnType = (
  name: string,
  config?: object,
) => PgColumnBuilder | PgTimestampBuilderInitial<string>;
export function createCustomTypeWithMeta<T extends ColumnType>(
  colType: ColumnType,
  meta: CustomTypeMeta,
  options?: {
    extraConfig?: (
      colBuilder: PgColumnBuilder | PgTimestampBuilderInitial<string>,
    ) => ReturnType<T>;
  },
) {
  const { extraConfig } = options ?? {};
  return (name: string, config?: object): ReturnType<T> => {
    const columnBuilder = colType(name, config);
    setCustomTypeMeta(columnBuilder, meta);
    return (
      extraConfig ? extraConfig(columnBuilder as ReturnType<T>) : columnBuilder
    ) as ReturnType<T>;
  };
}

export const updatedAt = createCustomTypeWithMeta<typeof timestamp>(timestamp, {
  isUpdatedAt: true,
});
