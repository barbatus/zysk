import {
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY,
  DIMENSION_NAME_POSITION_ID,
  DIMENSION_NAME_PERIOD,
  DIMENSION_NAME_TICKER,
  DIMENSION_NAME_QUOTE,
} from "./shared/constants";

cube(`PortfolioCube`, {
  public: false,

  sql: `
    WITH pq AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date ASC) row
      FROM ticker_quotes
      WHERE ${FILTER_PARAMS.Portfolio.period.filter("date")}
    )

    SELECT
      ut.*,
      q1.open_price as ticker_open_price,
      q2.close_price as ticker_close_price,
      pq.date as start_date,
      pq.open_price as start_price
    FROM user_tickers ut
    JOIN ticker_quotes q1 ON ut.symbol = q1.symbol AND ut.opened_at::date = q1.date
    LEFT JOIN ticker_quotes q2 ON ut.symbol = q2.symbol AND ut.closed_at::date = q2.date
    JOIN pq ON pq.symbol = ut.symbol AND pq.row = 1
  `,

  joins: {
    Users: {
      sql: `${CUBE.userId} = ${Users.id}`,
      relationship: `many_to_one`
    },

    CurrentQuotes: {
      sql: `${CUBE.symbol} = ${CurrentQuotes.symbol}`,
      relationship: `one_to_one`,
    },
  },

  dimensions: {
    [DIMENSION_NAME_POSITION_ID]: {
      type: `string`,
      sql: `id`,
      primaryKey: true,
    },

    userId: {
      type: `string`,
      sql: `user_id`,
    },

    [DIMENSION_NAME_TICKER]: {
      type: `string`,
      sql: `symbol`,
    },

    amount: {
      type: `number`,
      sql: `amount`,
    },

    openPrice: {
      type: `number`,
      sql: `open_price`,
    },

    closePrice: {
      type: `number`,
      sql: `close_price`,
    },

    openedAt: {
      type: `time`,
      sql: `opened_at`,
    },

    closedAt: {
      type: `time`,
      sql: `closed_at`,
    },

    period: {
      type: `time`,
      sql: `start_date`,
    },
  },

  measures: {
    openValue: {
      type: `number`,
      sql: `
        CASE
          WHEN ${CUBE.openedAt} >= ${CUBE.period} THEN COALESCE(${CUBE.openPrice}, ${CUBE}.ticker_open_price)
          ELSE ${CUBE}.start_price
        END
      `,
    },
    closeValue: {
      type: `number`,
      sql: `
        CASE
          WHEN ${CUBE.closedAt} >= ${CUBE.period} THEN COALESCE(${CUBE.closePrice}, ${CUBE}.ticker_close_price)
          WHEN ${CUBE.closedAt} IS NULL THEN ${CurrentQuotes[DIMENSION_NAME_QUOTE]}
          ELSE NULL
        END
      `,
    },
    ...([
      METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS,
      METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH,
      METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY
    ].reduce((acc, metricName) => {
      acc[metricName] = {
        type: `sum`,
        sql: `${CUBE.amount} * (${CUBE.closeValue} - ${CUBE.openValue})`,
      };
      return acc;
    }, {})),
  },
});

view(`Portfolio`, {
  cubes: [
    {
      join_path: PortfolioCube,
      includes: [
        DIMENSION_NAME_POSITION_ID,
        DIMENSION_NAME_TICKER,
        DIMENSION_NAME_PERIOD,
        METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS,
        METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH,
        METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY,
      ],
    },
  ],
});

