import { METRIC_NAME_USER_PORTFOLIO_SEGMENTS } from "./shared/constants";

cube(`TickerSegmentsCube`, {
  public: false,

  sql: `
    WITH segments as (
      SELECT
        symbol,
        segment,
        ratio::numeric AS ratio
      FROM public.ticker,
        jsonb_array_elements(sectors) AS element,
        jsonb_each_text(element) AS t(segment, ratio)
    )
    SELECT
      ut.user_id,
      ut.symbol,
      s.segment,
      AVG(s.ratio) as ratio
    FROM public.user_tickers ut
    JOIN segments s ON ut.symbol = s.symbol
    GROUP BY 1, 2, 3
  `,

  dimensions: {
    id: {
      type: `string`,
      sql: `${CUBE.userId} || '-' || ${CUBE.symbol} || '-' || ${CUBE.segment}`,
      primaryKey: true,
    },

    userId: {
      type: `string`,
      sql: `user_id`,
    },

    symbol: {
      sql: `symbol`,
      type: `string`
    },

    segment: {
      sql: `segment`,
      type: `string`
    },

    ratio: {
      sql: `ratio`,
      type: `number`
    },
  },

  measures: {
    avgRatio: {
      type: `number`,
      sql: `AVG(${CUBE.ratio})`
    },
  },
});

cube(`PortfolioSegmentsCube`, {
  extends: TickerSegmentsCube,

  public: false,

  joins: {
    TickerSegmentsCube: {
      sql: `${CUBE.id} = ${TickerSegmentsCube.id}`,
      relationship: `one_to_many`,
    },
  },

  dimensions: {
    ratio: {
      type: `number`,
      sql: `${TickerSegmentsCube.avgRatio}`,
      sub_query: true
    },
  },

  measures: {
    [METRIC_NAME_USER_PORTFOLIO_SEGMENTS]: {
      type: `string`,
      sql: `JSONB_OBJECT_AGG(${CUBE.segment}, ${CUBE.ratio})`,
    },
  },
});

view(`PortfolioSegments`, {
  cubes: [
    {
      join_path: PortfolioSegmentsCube,
      includes: [
        `symbol`,
        METRIC_NAME_USER_PORTFOLIO_SEGMENTS,
      ],
    },
  ],
});
