cube(`CurrentQuotes`, {
  sql_table: `public.current_quotes`,

  dimensions: {
    symbol: {
      type: `string`,
      sql: `symbol`,
      primaryKey: true,
    },

    updated_at: {
      type: `time`,
      sql: `date`,
    },

    price: {
      type: `number`,
      sql: `price`,
    },
  },
});
