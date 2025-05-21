import { z } from "zod";

export enum PredictionEnum {
  WillGrow = "will_grow",
  LikelyGrow = "likely_grow",
  StayTheSame = "stay_the_same",
  LikelyFall = "likely_fall",
  WillFall = "will_fall",
}

const InsightSchema = z.object({
  insight: z.string(),
  impact: z.enum(["positive", "negative", "mixed"]),
  reasoning: z.string(),
  url: z.string().url().optional(),
});

export const PredictionSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  prediction: z.nativeEnum(PredictionEnum),
  confidence: z.number(),
  createdAt: z.coerce.date(),
  insights: z.array(InsightSchema),
});

export type Prediction = z.infer<typeof PredictionSchema>;
