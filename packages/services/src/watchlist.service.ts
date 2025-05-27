import { type Database, PredictionEnum } from "@zysk/db";
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

    const buildPrediction = (prediction: (typeof result)[number]) => {
      const isNegative =
        prediction.prediction === PredictionEnum.WillFall ||
        prediction.prediction === PredictionEnum.LikelyFall;
      const responseJson = prediction.responseJson!;
      const insights = responseJson.insights.sort((a, b) => {
        if (isNegative && a.impact !== b.impact) {
          return a.impact === "positive" ? 1 : -1;
        }

        if (!isNegative && a.impact !== b.impact) {
          return a.impact === "negative" ? 1 : -1;
        }

        return b.confidence - a.confidence;
      });

      return {
        ...omit(prediction, "responseJson"),
        prediction: prediction.prediction!,
        confidence: Number(prediction.confidence),
        createdAt: prediction.createdAt!,
        insights,
        reasoning: responseJson.reasoning,
      };
    };

    return Object.entries(groupedPredictions).map(([_, rows]) => {
      const subscription = rows[0];
      return {
        ...subscription,
        prediction: subscription.pId
          ? buildPrediction({
              ...subscription,
              id: subscription.pId,
            })
          : undefined,
      };
    });
  }
}
