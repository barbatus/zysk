cube(`CurrentQuote`, {
  sql_table: `public.rl_quote`,

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
