import { DIMENSION_NAME_TICKER, DIMENSION_NAME_QUOTE, METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE } from "./shared/constants";

cube(`QuotesCube`, {
  public: false,

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
    [DIMENSION_NAME_TICKER]: {
      type: `string`,
      sql: `symbol`,
      primaryKey: true,
    },

    close_price: {
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
        CASE
          WHEN ${CUBE.week} = date_trunc('week', ${CurrentQuotes.date} - INTERVAL '1 week')
            THEN (${CurrentQuotes[DIMENSION_NAME_QUOTE]} - ${CUBE.close_price}) / ${CUBE.close_price} * 100
          ELSE 0
        END
      `,
      format: `percent`,
    },
  },
});

view(`TickerMetrics`, {
  cubes: [
    {
      join_path: QuotesCube,
      includes: [
        DIMENSION_NAME_TICKER,
        METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE,
      ],
    },
    {
      join_path: CurrentQuotes,
      includes: [
        DIMENSION_NAME_QUOTE,
      ],
    },
  ],
});
