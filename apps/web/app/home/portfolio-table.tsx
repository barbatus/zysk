"use client";

import Box from "@mui/joy/Box";
import { type ColumnDef } from "@tanstack/react-table";
import {
  type ALL_DIMENSIONS,
  type ALL_METRICS,
  DIMENSION_NAME_TICKER,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY,
  METRIC_NAME_USER_PORTFOLIO_SEGMENTS,
} from "@zysk/cube";
import { type MetricObject, type MetricValue } from "@zysk/ts-rest";
import { fromPairs, zip } from "lodash";

import { metricsApi } from "#/api/metrics";
import { getUserTimezone } from "#/lib/time";
import { DataTable } from "#/ui/data-table";

type MetricsRow = Record<(typeof ALL_DIMENSIONS)[number], string> &
  Record<
    Exclude<
      (typeof ALL_METRICS)[number],
      typeof METRIC_NAME_USER_PORTFOLIO_SEGMENTS
    >,
    MetricValue
  > & {
    [METRIC_NAME_USER_PORTFOLIO_SEGMENTS]: MetricObject;
  };

const columns = [
  {
    id: "ticker",
    header: "Ticker",
    cell: ({ row }) => (
      <Box width={64}>{row.original[DIMENSION_NAME_TICKER]}</Box>
    ),
  },
  {
    id: "todayGainLoss",
    header: "Today's gain/loss",
    cell: ({ row }) => (
      <Box width={64}>
        {row.original[METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY]}
      </Box>
    ),
  },
  {
    id: "lastMonthGainLoss",
    header: "Last month's gain/loss",
    cell: ({ row }) => (
      <Box width={64}>
        {row.original[METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH]}
      </Box>
    ),
  },
  {
    id: "last3MonthsGainLoss",
    header: "Last 3 months' gain/loss",
    cell: ({ row }) => (
      <Box width={64}>
        {row.original[METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS]}
      </Box>
    ),
  },
] as ColumnDef<MetricsRow>[];

export function TickerTable() {
  const { data } = metricsApi.evalQuery.useQuery({
    queryKey: ["metrics"],
    queryData: {
      query: {
        metrics: [
          METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH,
          METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY,
          METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS,
          METRIC_NAME_USER_PORTFOLIO_SEGMENTS,
        ],
        groupBys: [[], [DIMENSION_NAME_TICKER]],
        timezone: getUserTimezone(),
      },
    },
    select: (d) => d.body,
  });

  const rColumns = data?.results[1].columns ?? [];
  const rRows = data?.results[1].rows ?? [];

  const rows = rRows.map((row) => {
    const pairs = zip(rColumns, row);
    const records = fromPairs(pairs) as {
      [METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH]: MetricValue;
      [METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY]: MetricValue;
      [METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS]: MetricValue;
      [METRIC_NAME_USER_PORTFOLIO_SEGMENTS]: MetricObject;
      [DIMENSION_NAME_TICKER]: string;
    };
    return records;
  });

  return <DataTable data={rows} columns={columns} stripe="even" />;
}
