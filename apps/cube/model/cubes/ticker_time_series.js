cube(`TickerTimeSeries`, {
  sql_table: `app_data.ticker_time_series`,

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
