import { z } from "zod";

export enum SentimentEnum {
  Bullish = "bullish",
  LikelyBullish = "likely_bullish",
  Bearish = "bearish",
  LikelyBearish = "likely_bearish",
  Neutral = "neutral",
}

const InsightSchema = z.object({
  insight: z.string(),
  impact: z.enum(["positive", "negative", "mixed", "neutral"]),
  reasoning: z.string(),
  url: z.string().url().optional(),
});

export const TickerSentimentPredictionSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  sentiment: z.nativeEnum(SentimentEnum),
  reasoning: z.string(),
  confidence: z.number(),
  createdAt: z.coerce.date(),
  insights: z.array(InsightSchema),
});

export type TickerSentimentPrediction = z.infer<
  typeof TickerSentimentPredictionSchema
>;
