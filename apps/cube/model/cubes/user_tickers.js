import { METRIC_NAME_USER_TICKER_GAIN_LOSS_LAST_MONTH } from './shared/constants';

cube(`UserTickers`, {

  sql: `
    WITH period_query AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date ASC) row
      FROM quote
      WHERE ${FILTER_PARAMS.UserTickers.period.filter("date")}
    )

    SELECT
      ut.*,
      q1.open_price as open_day_price,
      q2.close_price as close_day_price,
      pq.date as period,
      pq.open_price as period_open_price
    FROM user_tickers ut
    JOIN quote q1 ON ut.symbol = q1.symbol AND ut.opened_at::date = q1.date
    LEFT JOIN quote q2 ON ut.symbol = q2.symbol AND ut.closed_at::date = q2.date
    JOIN period_query pq ON pq.symbol = ut.symbol AND pq.row = 1
  `,

  joins: {
    User: {
      sql: `${CUBE}.user_id = ${User}.id`,
      relationship: `many_to_one`
    },

    CurrentQuote: {
      sql: `${CUBE.symbol} = ${CurrentQuote.symbol}`,
      relationship: `one_to_one`,
    },
  },

  dimensions: {
    id: {
      type: `string`,
      sql: `${CUBE}.user_id || '-' || ${CUBE}.symbol`,
      primaryKey: true,
    },

    userId: {
      type: `string`,
      sql: `user_id`,
    },

    symbol: {
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
      sql: `period`,
    },
  },

  measures: {
    openValue: {
      type: `number`,
      sql: `
        CASE WHEN ${CUBE.openedAt} >= ${CUBE.period} THEN COALESCE(${CUBE.openPrice}, ${CUBE}.open_day_price)
             ELSE ${CUBE}.period_open_price
        END
      `,
    },
    closeValue: {
      type: `number`,
      sql: `
        CASE WHEN ${CUBE.closedAt} >= ${CUBE.period} THEN COALESCE(${CUBE.closePrice}, ${CUBE}.close_day_price)
             WHEN ${CUBE.closedAt} IS NULL THEN ${CurrentQuote.price}
             ELSE NULL
        END
      `,
    },
    [METRIC_NAME_USER_TICKER_GAIN_LOSS_LAST_MONTH]: {
      type: `sum`,
      sql: `${CUBE.amount} * (${CUBE.closeValue} - ${CUBE.openValue})`,
    },
  },
});
