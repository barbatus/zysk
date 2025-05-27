import {
  DIMENSION_NAME_TICKER,
  DIMENSION_NAME_QUOTE,
  METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE,
  METRIC_NAME_TICKER_PREV_DAY_PERFORMANCE,
} from "./shared/constants";

cube(`WeeklyQuotesCube`, {

  sql: `
    WITH weekly_quotes AS (
      SELECT
        symbol,
        date_trunc('week', date) as week,
        close_price,
        ROW_NUMBER() OVER (
          PARTITION BY symbol, date_trunc('week', date)
          ORDER BY date DESC
        ) as rn
      FROM app_data.ticker_time_series
      WHERE date >= NOW() - INTERVAL '1 month'
    )
    SELECT
      symbol,
      week,
      close_price
    FROM weekly_quotes
    WHERE rn = 1
  `,

  joins: {
    CurrentQuotes: {
      sql: `${CUBE.symbol} = ${CurrentQuotes.symbol}`,
      relationship: `many_to_one`,
    }
  },

  dimensions: {
    id: {
      sql: `${CUBE}.symbol || '-' || ${CUBE}.week`,
      type: `string`,
      primaryKey: true,
    },

    [DIMENSION_NAME_TICKER]: {
      type: `string`,
      sql: `symbol`,
    },

    closePrice: {
      type: `number`,
      sql: `close_price`,
    },

    week: {
      type: `string`,
      sql: `week`,
    },
  },

  measures: {
    [METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE]: {
      type: `sum`,
      sql: `
        (${CurrentQuotes[DIMENSION_NAME_QUOTE]} - ${CUBE.closePrice}) / ${CUBE.closePrice} * 100
      `,
      format: `percent`,
      filters: [{
        sql: `
          ${CUBE.week} = date_trunc('week', ${CurrentQuotes.date} - INTERVAL '1 week')
        `,
      }],
    },
  },
});


cube(`DailyQuotesCube`, {

  sql: `
    SELECT
      *,
      ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) as rn
    FROM app_data.ticker_time_series
  `,

  joins: {
    CurrentQuotes: {
      sql: `${CUBE.symbol} = ${CurrentQuotes.symbol}`,
      relationship: `many_to_one`,
    },

    WeeklyQuotesCube: {
      sql: `${CUBE.symbol} = ${WeeklyQuotesCube.symbol} AND date_trunc('week', ${CUBE.date}) = ${WeeklyQuotesCube.week}`,
      relationship: `many_to_one`,
    },
  },

  dimensions: {
    id: {
      sql: `${CUBE}.symbol || '-' || ${CUBE}.date`,
      type: `string`,
      primaryKey: true,
    },

    symbol: {
      sql: `symbol`,
      type: `string`
    },

    date: {
      sql: `date`,
      type: `time`
    },

    openPrice: {
      sql: `open_price`,
      type: `number`,
    },

    closePrice: {
      sql: `close_price`,
      type: `number`,
    },

    rn: {
      sql: `rn`,
      type: `number`,
    },
  },

  measures: {
    [METRIC_NAME_TICKER_PREV_DAY_PERFORMANCE]: {
      type: `sum`,
      sql: `
        (${CurrentQuotes[DIMENSION_NAME_QUOTE]} - ${CUBE.closePrice}) / ${CUBE.closePrice} * 100
      `,
      format: `percent`,
      filters: [{
        sql: `
          ${CUBE.rn} = 1 AND ${CUBE.date} = date_trunc('day', ${CurrentQuotes.date} - INTERVAL '1 day')
        `,
      }],
    },
  },
});


view(`TickerMetrics`, {
  cubes: [
    {
      join_path: CurrentQuotes,
      includes: [
        DIMENSION_NAME_TICKER,
        DIMENSION_NAME_QUOTE,
      ],
    },
    {
      join_path: CurrentQuotes.WeeklyQuotesCube,
      includes: [
        METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE,
      ],
    },
    {
      join_path: CurrentQuotes.DailyQuotesCube,
      includes: [
        METRIC_NAME_TICKER_PREV_DAY_PERFORMANCE,
      ],
    },
  ],
});
