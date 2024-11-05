"use client";

import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type ColumnDef } from "@tanstack/react-table";
import {
  DIMENSION_NAME_TICKER,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY,
  METRIC_NAME_USER_PORTFOLIO_SEGMENTS,
} from "@zysk/cube";
import { type Position } from "@zysk/ts-rest";

import { type MetricsRow } from "#/api/metrics";
import { usePortfolio } from "#/api/portfolio";
import { formatGridTime, formatPercent } from "#/lib/formatters";
import { DataTable } from "#/ui/data-table";

const columns = [
  {
    id: "ticker",
    header: "Ticker",
    cell: ({ row }) => {
      const expandable = row.getCanExpand();
      return (
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: "center",
            paddingLeft: `${row.depth * 4}rem`,
          }}
        >
          {expandable ? (
            <IconButton onClick={row.getToggleExpandedHandler()} size="sm">
              <ChevronRightIcon />
            </IconButton>
          ) : null}
          <Box>{row.original[DIMENSION_NAME_TICKER]}</Box>
        </Stack>
      );
    },
    footer: () => (
      <Typography level="body-md" fontWeight="lg" sx={{ paddingLeft: 2 }}>
        Total
      </Typography>
    ),
  },
  {
    id: "open",
    header: "Opened At & Price",
    cell: ({ row }) => (
      <Typography level="body-sm" whiteSpace="nowrap">
        {row.original.entity?.openedAt
          ? formatGridTime(row.original.entity.openedAt)
          : ""}
      </Typography>
    ),
    size: 120,
  },
  {
    id: "todayGainLoss",
    header: "Today's change",
    cell: ({ row }) => (
      <Typography level="body-sm">
        {row.original[METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY]}
      </Typography>
    ),
    footer: ({ row }) =>
      row ? (
        <Typography level="body-md">
          {row[METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY]}
        </Typography>
      ) : null,
    size: 64,
  },
  {
    id: "lastMonthGainLoss",
    header: "1m gain/loss",
    cell: ({ row }) => (
      <Typography level="body-sm">
        {row.original[METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH]}
      </Typography>
    ),
    footer: ({ row }) =>
      row ? (
        <Typography level="body-sm">
          {row[METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH]}
        </Typography>
      ) : null,
    size: 64,
  },
  {
    id: "last3MonthsGainLoss",
    header: "3m gain/loss",
    cell: ({ row }) => (
      <Typography level="body-sm">
        {row.original[METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS]}
      </Typography>
    ),
    footer: ({ row }) =>
      row ? (
        <Typography level="body-sm">
          {row[METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS]}
        </Typography>
      ) : null,
    size: 64,
  },
  {
    id: "segments",
    header: "Segments",
    footer: ({ row }) => {
      if (!row?.[METRIC_NAME_USER_PORTFOLIO_SEGMENTS]) {
        return null;
      }

      const segments = Object.entries(
        row[METRIC_NAME_USER_PORTFOLIO_SEGMENTS],
      ).toSorted((a, b) => b[1] - a[1]);
      return (
        <Stack direction="row" gap={0.5}>
          {segments.map(([segment, value]) => (
            <Chip
              key={segment}
              size="sm"
              variant="outlined"
              endDecorator={
                <Typography level="body-xs" fontWeight="lg">
                  {formatPercent(value)}
                </Typography>
              }
            >
              {segment}
            </Chip>
          ))}
        </Stack>
      );
    },
  },
] as ColumnDef<MetricsRow & { entity?: Position }>[];

export function PortfolioTable() {
  const { rows, total } = usePortfolio();

  return (
    <DataTable data={rows} columns={columns} footerRow={total} stripe="even" />
  );
}
