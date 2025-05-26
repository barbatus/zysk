"use client";

import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import {
  DIMENSION_NAME_QUOTE,
  DIMENSION_NAME_TICKER,
  METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE,
} from "@zysk/cube";
import { watchlistContract } from "@zysk/ts-rest";

import { getResultRows, useMetrics } from "./metrics";

export const watchlistApi = initTsrReactQuery(watchlistContract, {
  baseUrl: process.env.NEXT_PUBLIC_API_HOST_URL!,
  jsonQuery: true,
});

export const useWatchlist = () => {
  return watchlistApi.getWatchlist.useQuery({
    queryKey: ["watchlist"],
    select: (d) => d.body,
  });
};

export const useWatchlistMetrics = () => {
  const { data: metrics } = useMetrics(
    [METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE],
    [[DIMENSION_NAME_TICKER, DIMENSION_NAME_QUOTE]],
  );

  return {
    metrics,
    rows: getResultRows(metrics?.results ?? [], 0),
  };
};
