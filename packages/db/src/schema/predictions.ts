import { date, jsonb, numeric, pgTable, uuid, varchar } from "drizzle-orm/pg-core";

import { auditColumns } from "../utils/audit";
import { validatedStringEnum } from "./columns";
import { experimentsTable } from "./experiments";

export enum SentimentEnum {
  Bullish = "bullish",
  LikelyBullish = "likely_bullish",
  Bearish = "bearish",
  LikelyBearish = "likely_bearish",
  Neutral = "neutral",
}

export interface PredictionResponse {
  prediction: SentimentEnum;
  confidence: number;
  reasoning: string;
  insights: {
    insight: string;
    impact: "positive" | "negative" | "mixed" | "neutral";
    reasoning: string;
    url?: string;
    date: string;
    confidence: number;
  }[];
}

export const predictionsTable = pgTable("predictions", {
  id: uuid("id").defaultRandom().primaryKey(),
  symbol: varchar("symbol", { length: 255 }).notNull(),
  prediction: validatedStringEnum("prediction", SentimentEnum).notNull(),
  confidence: numeric("confidence").notNull(),
  responseJson: jsonb("response_json").$type<PredictionResponse>().notNull(),
  experimentId: uuid("experiment_id").references(() => experimentsTable.id),
  period: date("period"),
  ...auditColumns(),
});
