"use client";

import Box from "@mui/joy/Box";
import Grid from "@mui/joy/Grid";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { keyBy } from "lodash";
import { Search } from "lucide-react";

import { useWatchlist, useWatchlistMetrics } from "#/api/watchlist";
import {
  PredictionCardSkeleton,
  TickerPredictionCard,
} from "#/ui/prediction-card";

export function Watchlist() {
  const { data: predictions, isLoading } = useWatchlist();
  const { rows } = useWatchlistMetrics();

  const rowsBySymbol = keyBy(rows, "symbol");

  return (
    <Stack spacing={3}>
      <Box>
        <Typography level="h3" fontWeight="lg">
          My Watchlist
        </Typography>
      </Box>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ position: "relative", flex: 1 }}>
          <Input
            placeholder="Search stocks to add or filter..."
            startDecorator={<Search size={16} />}
          />
        </Box>
      </Stack>
      <Grid container spacing={2}>
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <Grid key={index} xs={12} sm={6} lg={3}>
                <PredictionCardSkeleton />
              </Grid>
            ))
          : predictions!.map((p) => (
              <Grid key={p.symbol} xs={12} sm={6} lg={3}>
                <TickerPredictionCard
                  sx={{ height: "100%" }}
                  symbol={p.symbol}
                  lastPrediction={p.lastPrediction}
                  currentQuote={rowsBySymbol[p.symbol]}
                />
              </Grid>
            ))}
      </Grid>
    </Stack>
  );
}
