"use client";

import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import {
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY,
  METRIC_NAME_USER_PORTFOLIO_SEGMENTS,
} from "@zysk/cube";
import { portfolioContract } from "@zysk/ts-rest";
import { keyBy } from "lodash";

import { useMetrics } from "./metrics";

export const portfolioApi = initTsrReactQuery(portfolioContract, {
  baseUrl: process.env.NEXT_PUBLIC_API_HOST_URL!,
  jsonQuery: true,
});

export const usePortfolio = () => {
  const { rows, ...metricsRes } = useMetrics([
    METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH,
    METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY,
    METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS,
    METRIC_NAME_USER_PORTFOLIO_SEGMENTS,
  ]);

  const { data: portfolioData, ...portfolioRes } =
    portfolioApi.queryWithFilter.useQuery({
      queryKey: ["portfolio"],
      select: (d) => d.body,
    });

  const portfolio = keyBy(portfolioData ?? [], "id");
  return {
    metrics: metricsRes.data,
    total: metricsRes.total,
    positions: portfolioData,
    isLoading: metricsRes.isLoading ?? portfolioRes.isLoading,
    isFetching: metricsRes.isFetching ?? portfolioRes.isFetching,
    error: metricsRes.error ?? portfolioRes.error,
    rows: rows.map((r) => ({
      ...r,
      subRows: (r.subRows ?? []).map((subRow) => ({
        ...subRow,
        entity: portfolio[subRow.position],
      })),
    })),
  };
};
