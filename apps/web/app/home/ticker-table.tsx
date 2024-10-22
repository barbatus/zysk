"use client";

import Box from "@mui/joy/Box";
import { type ColumnDef } from "@tanstack/react-table";
import {
  type ALL_DIMENSIONS,
  type ALL_METRICS,
  DIMENSION_NAME_TICKER,
  METRIC_NAME_USER_TICKER_GAIN_LOSS_LAST_MONTH,
} from "@zysk/cube";
import { type MetricValue } from "@zysk/ts-rest";
import { fromPairs, zip } from "lodash";

import { metricsApi } from "#/api/metrics";
import { DataTable } from "#/ui/data-table";

type MetricsRow = Record<(typeof ALL_DIMENSIONS)[number], string> &
  Record<(typeof ALL_METRICS)[number], MetricValue>;

const columns = [
  {
    id: "ticker",
    header: "Ticker",
    cell: ({ row }) => (
      <Box width={64}>{row.original[DIMENSION_NAME_TICKER]}</Box>
    ),
  },
  {
    id: "monthlyGainLoss",
    header: "Monthly Gain/Loss",
    cell: ({ row }) => (
      <Box width={64}>
        {row.original[METRIC_NAME_USER_TICKER_GAIN_LOSS_LAST_MONTH]}
      </Box>
    ),
  },
] as ColumnDef<MetricsRow>[];

export function TickerTable() {
  const { data } = metricsApi.evalQuery.useQuery({
    queryKey: ["metrics"],
    queryData: {
      query: {
        metrics: [METRIC_NAME_USER_TICKER_GAIN_LOSS_LAST_MONTH],
        groupBys: [[DIMENSION_NAME_TICKER]],
      },
    },
    select: (d) => d.body,
  });

  const rColumns = data?.results[0].columns ?? [];
  const rRows = data?.results[0].rows ?? [];

  const rows = rRows.map((row) => {
    const pairs = zip(rColumns, row) as [string, MetricValue][];
    const records = fromPairs(pairs) as {
      [METRIC_NAME_USER_TICKER_GAIN_LOSS_LAST_MONTH]: MetricValue;
      [DIMENSION_NAME_TICKER]: string;
    };
    return records;
  });

  return <DataTable data={rows} columns={columns} stripe="even" />;
}
