cube(`Quotes`, {
  sql_table: `public.ticker_quotes`,

  joins: {
    CurrentQuotes: {
      sql: `${CUBE.symbol} = ${CurrentQuotes.symbol}`,
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
