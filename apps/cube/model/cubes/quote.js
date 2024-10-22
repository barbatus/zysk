cube(`Quote`, {
  sql_table: `public.quote`,

  joins: {
    CurrentQuote: {
      sql: `${CUBE.symbol} = ${CurrentQuote.symbol}`,
      relationship: `one_to_one`,
    }
  },

  dimensions: {
    symbol: {
      sql: `symbol`,
      type: `string`
    },

    date: {
      sql: `date`,
      type: `time`
    },

    openPrice: {
      sql: `value`,
      type: `number`,
    },

    closePrice: {
      sql: `value`,
      type: `number`,
    },
  },
});
