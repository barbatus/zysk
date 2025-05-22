import { type Database, PredictionEnum } from "@zysk/db";
import { inject, injectable } from "inversify";
import { type Kysely } from "kysely";
import { groupBy } from "lodash";

import { appDBSymbol } from "./db";

@injectable()
export class SubscriptionsService {
  constructor(@inject(appDBSymbol) private readonly db: Kysely<Database>) {}

  async getSubscriptions(userId: string) {
    const query = this.db
      .selectFrom("subscriptions as s")
      .leftJoin(
        (eb) =>
          eb
            .selectFrom("predictions as p")
            .selectAll()
            .distinctOn("p.symbol")
            .orderBy("p.symbol")
            .orderBy("p.createdAt", "desc")
            .as("lp"),
        (join) => join.onRef("lp.symbol", "=", "s.symbol"),
      )
      .where("s.userId", "=", userId)
      .select([
        "s.id",
        "s.symbol",
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
      const insights = prediction
        .responseJson!.insights.filter(
          (i) => i.impact === (isNegative ? "negative" : "positive"),
        )
        .sort((a, b) => b.confidence - a.confidence);

      return {
        ...prediction,
        prediction: prediction.prediction!,
        confidence: Number(prediction.confidence),
        createdAt: prediction.createdAt!,
        insights,
      };
    };

    return Object.entries(groupedPredictions).map(([_, rows]) => {
      const subscription = rows[0];
      return {
        ...subscription,
        lastPrediction: subscription.pId
          ? buildPrediction({
              ...subscription,
              id: subscription.pId,
            })
          : undefined,
      };
    });
  }
}
