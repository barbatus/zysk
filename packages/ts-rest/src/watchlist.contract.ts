import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { PredictionSchema } from "./predictions.contract";

const c = initContract();

export const WatchlistSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  isActive: z.boolean(),
  lastPrediction: PredictionSchema.optional(),
});

export const WatchlistResponseSchema = z.array(WatchlistSchema);

export type WatchlistResponse = z.infer<typeof WatchlistResponseSchema>;

export const watchlistContract = c.router(
  {
    getWatchlist: {
      method: "GET",
      path: "query",
      responses: {
        200: WatchlistResponseSchema,
        400: z.object({
          error: z.string(),
        }),
      },
    },
  },
  {
    pathPrefix: "/api/v1/watchlist/",
  },
);
