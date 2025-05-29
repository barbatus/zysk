import { type Database, SentimentEnum } from "@zysk/db";
import { inject, injectable } from "inversify";
import { type Kysely } from "kysely";
import { groupBy, omit } from "lodash";

import { appDBSymbol } from "./db";

@injectable()
export class WatchlistService {
  constructor(@inject(appDBSymbol) private readonly db: Kysely<Database>) {}

  async getWatchlist(userId: string) {
    const query = this.db
      .selectFrom("subscriptions as s")
      .innerJoin("tickers as t", "t.symbol", "s.symbol")
      .leftJoin(
        (eb) =>
          eb
            .selectFrom("predictions as p")
            .selectAll()
            .distinctOn("p.symbol")
            .orderBy("p.symbol")
            .orderBy("p.createdAt", "desc")
            .as("lp"),
        (join) => join.onRef("lp.symbol", "=", "t.symbol"),
      )
      .where("s.userId", "=", userId)
      .select([
        "s.id",
        "s.symbol",
        "t.about",
        "s.isActive",
        "lp.id as pId",
        "lp.prediction",
        "lp.confidence",
        "lp.createdAt",
        "lp.responseJson",
      ]);

    const result = await query.execute();

    const groupedPredictions = groupBy(result, "id");

    const normalizeConfidence = (
      sentiment: SentimentEnum,
      confidence: number,
    ) => {
      if (
        sentiment === SentimentEnum.Bullish ||
        sentiment === SentimentEnum.Bearish
      ) {
        return 100 - confidence + 1;
      }

      if (
        sentiment === SentimentEnum.LikelyBullish ||
        sentiment === SentimentEnum.LikelyBearish
      ) {
        return 90 - confidence + 1;
      }

      return confidence / 80;
    };

    const buildSentimentPrediction = (prediction: (typeof result)[number]) => {
      const responseJson = prediction.responseJson!;
      return {
        ...omit(prediction, "responseJson"),
        sentiment: prediction.prediction!,
        confidence: Number(prediction.confidence),
        createdAt: prediction.createdAt!,
        insights: responseJson.insights.map((insight) => ({
          ...insight,
          confidence: normalizeConfidence(
            prediction.prediction!,
            Number(insight.confidence),
          ),
        })),
        reasoning: responseJson.reasoning,
      };
    };

    return Object.entries(groupedPredictions).map(([_, rows]) => {
      const subscription = rows[0];
      return {
        ...subscription,
        prediction: subscription.pId
          ? buildSentimentPrediction({
              ...subscription,
              id: subscription.pId,
            })
          : undefined,
      };
    });
  }
}
