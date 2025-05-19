import { jsonb, numeric, pgTable, uuid, varchar } from "drizzle-orm/pg-core";

import { auditColumns } from "../utils/audit";
import { validatedStringEnum } from "./columns";

export enum PredictionEnum {
  WillGrow = "will_grow",
  LikelyGrow = "likely_grow",
  StayTheSame = "stay_the_same",
  LikelyFall = "likely_fall",
  WillFall = "will_fall",
}

export interface PredictionResponse {
  prediction: PredictionEnum;
  confidence: number;
  reasoning: string;
  insights: {
    insight: string;
    impact: "positive" | "negative" | "mixed";
    reasoning: string;
    url?: string;
    date: Date;
    confidence: number;
  }[];
}

export const predictionsTable = pgTable("predictions", {
  id: uuid("id").defaultRandom().primaryKey(),
  symbol: varchar("symbol", { length: 255 }).notNull(),
  prediction: validatedStringEnum("prediction", PredictionEnum).notNull(),
  confidence: numeric("confidence").notNull(),
  responseJson: jsonb("response_json").$type<PredictionResponse>().notNull(),
  ...auditColumns(),
});
