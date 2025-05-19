import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { PredictionSchema } from "./predictions.contract";

const c = initContract();

export const SubscriptionSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  isActive: z.boolean(),
  lastPrediction: PredictionSchema.optional(),
});

export const SubscriptionsResponseSchema = z.array(SubscriptionSchema);

export type SubscriptionResponse = z.infer<typeof SubscriptionsResponseSchema>;

export const subscriptionsContract = c.router(
  {
    getSubscriptions: {
      method: "GET",
      path: "query",
      responses: {
        200: SubscriptionsResponseSchema,
        400: z.object({
          error: z.string(),
        }),
      },
    },
  },
  {
    pathPrefix: "/api/v1/subscriptions/",
  },
);
