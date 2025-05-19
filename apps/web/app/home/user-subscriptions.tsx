"use client";

import Grid from "@mui/joy/Grid";

import { useSubscriptions } from "#/api/subscriptions";
import { TickerPredictionCard } from "#/ui/prediction-card";

export function UserSubscriptions() {
  const { data: subscriptions, isLoading } = useSubscriptions();

  if (isLoading) {
    return null;
  }

  return (
    <Grid container spacing={2}>
      {subscriptions!.map((s) => (
        <Grid key={s.symbol} xs={12} sm={6} lg={3}>
          <TickerPredictionCard
            sx={{ height: "100%" }}
            symbol={s.symbol}
            lastPrediction={s.lastPrediction}
          />
        </Grid>
      ))}
    </Grid>
  );
}
