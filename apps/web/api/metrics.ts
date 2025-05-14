"use client";

import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import {
  type ALL_METRICS,
  DIMENSION_NAME_POSITION_ID,
  DIMENSION_NAME_TICKER,
  type METRIC_NAME_USER_PORTFOLIO_SEGMENTS,
} from "@zysk/cube";
import {
  type MetricObject,
  metricsContract,
  type MetricsRequest,
  type MetricValue,
  type QueryResultSet,
} from "@zysk/ts-rest";
import { fromPairs, groupBy, zip } from "lodash";

import { getUserTimezone } from "#/lib/time";

export const metricsApi = initTsrReactQuery(metricsContract, {
  baseUrl: process.env.NEXT_PUBLIC_API_HOST_URL!,
  jsonQuery: true,
});

export type MetricsRow = Record<
  typeof DIMENSION_NAME_TICKER | typeof DIMENSION_NAME_POSITION_ID,
  string
> &
  Record<(typeof ALL_METRICS)[number], MetricValue> & {
    [METRIC_NAME_USER_PORTFOLIO_SEGMENTS]: MetricObject;
  };

const getResultRows = (results: QueryResultSet[], index: number) => {
  const rColumns = results[index]?.columns ?? [];
  const rRows = results[index]?.rows ?? [];
  return rRows.map((row) => {
    const pairs = zip(rColumns, row);
    return fromPairs(pairs) as MetricsRow;
  });
};

export const useMetrics = (metrics: MetricsRequest["metrics"]) => {
  const { data, ...result } = metricsApi.evalQuery.useQuery({
    queryKey: ["metrics"],
    queryData: {
      query: {
        metrics,
        groupBys: [
          [],
          [DIMENSION_NAME_TICKER],
          [DIMENSION_NAME_POSITION_ID, DIMENSION_NAME_TICKER],
        ],
        timezone: getUserTimezone(),
      },
    },
    select: (d) => d.body,
  });

  const subRows = data?.results
    ? groupBy(getResultRows(data.results, 2), (r) => r[DIMENSION_NAME_TICKER])
    : ({} as Record<string, MetricsRow[]>);
  return {
    ...result,
    data,
    total: getResultRows(data?.results ?? [], 0)[0],
    rows: data?.results
      ? getResultRows(data.results, 1).map((row) => ({
          ...row,
          subRows: subRows[row[DIMENSION_NAME_TICKER]] ?? [],
        }))
      : [],
  };
};
