import { DIMENSION_NAME_QUOTE } from "./shared/constants";

cube(`CurrentQuotes`, {
  sql_table: `public.current_quotes`,

  dimensions: {
    symbol: {
      type: `string`,
      sql: `symbol`,
      primaryKey: true,
    },

    date: {
      type: `time`,
      sql: `updated_at`,
    },

    [DIMENSION_NAME_QUOTE]: {
      type: `number`,
      sql: `price`,
    },
  },
});
