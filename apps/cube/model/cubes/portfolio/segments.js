import {
  METRIC_NAME_USER_PORTFOLIO_SEGMENTS,
  DIMENSION_NAME_POSITION_ID,
  DIMENSION_NAME_TICKER,
} from "./shared/constants";

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
      s.segment,
      AVG(s.ratio) as ratio
    FROM public.user_tickers ut
    JOIN segments s ON ut.symbol = s.symbol
    GROUP BY 1
  `,

  dimensions: {
    segment: {
      sql: `segment`,
      type: `string`,
      primaryKey: true,
    },

    ratio: {
      sql: `ratio`,
      type: `number`
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
      join_path: TickerSegmentsCube,
      includes: [
        {
          name: `id`,
          alias: DIMENSION_NAME_POSITION_ID,
        },
        DIMENSION_NAME_TICKER,
        METRIC_NAME_USER_PORTFOLIO_SEGMENTS,
      ],
    },
  ],
});
