import { type Database, DataDatabase, PredictionInsert } from "@zysk/db";
import { format } from "date-fns";
import { inject, injectable } from "inversify";
import { type Kysely, sql } from "kysely";

import { appDBSymbol, dataDBSymbol } from "./db";
import { startOfWeek } from "./utils/datetime";
import { Exact } from "./utils/types";

@injectable()
export class PredictionService {
  constructor(
    @inject(dataDBSymbol) private readonly dataDb: Kysely<DataDatabase>,
    @inject(appDBSymbol) private readonly db: Kysely<Database>,
  ) {}

  async saveSymbolPrediction<T extends PredictionInsert>(
    symbol: string,
    prediction: Omit<Exact<T, PredictionInsert>, "symbol">,
  ) {
    await this.db
      .insertInto("predictions")
      .values({
        ...prediction,
        symbol,
        period: format(prediction.period, "yyyy-MM-dd"),
      })
      .execute();
  }

  async getLastGeneralMarketPredictionForPeriod(period: Date) {
    return this.getLastSymbolPredictionForPeriod("general", period, "weekly");
  }

  async getLastSymbolPredictionForPeriod(
    symbol: string,
    period: Date,
    type: "daily" | "weekly",
  ) {
    const prediction = await this.db
      .selectFrom("predictions")
      .selectAll()
      .where((eb) => eb(eb.fn("lower", [eb.ref("symbol")]), "=", symbol))
      .where("period", "<=", period)
      .$if(type === "daily", (eb) =>
        eb.where("period", ">=", startOfWeek(period)),
      )
      .orderBy("period", "desc")
      .orderBy("createdAt", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!prediction) {
      return null;
    }

    const experiment = await this.dataDb
      .selectFrom("app_data.experiments")
      .selectAll()
      .where("id", "=", prediction.experimentId)
      .executeTakeFirstOrThrow();

    return { prediction, experimentJson: experiment.responseJson };
  }

  async getPredictionsToEvaluate(symbols?: string[]) {
    return await this.db
      .selectFrom((eb1) =>
        eb1
          .selectFrom("predictions as p")
          .innerJoin("tickers", "p.symbol", "tickers.symbol")
          .select([
            "p.id",
            "p.symbol",
            "p.period",
            "p.type",
            "p.createdAt",
            "p.evaluation",
          ])
          .distinctOn(["p.symbol", "p.period"])
          .where("p.period", "is not", null)
          .where("p.type", "is not", null)
          .$if(Boolean(symbols), (eb2) => eb2.where("p.symbol", "in", symbols!))
          .orderBy(["p.symbol", "p.period", "p.createdAt desc"])
          .as("p"),
      )
      .selectAll()
      .where("evaluation", "is", null)
      .execute();
  }

  async updatePredictionEvaluation(
    evaluations: {
      id: string;
      evaluation: number;
    }[],
  ) {
    await this.db
      .updateTable("predictions")
      .from(
        evaluations
          .slice(1)
          .reduce(
            (qb, e) => {
              return qb.union(
                this.db.selectNoFrom([
                  sql<string>`${e.id}::uuid`.as("id"),
                  sql<number>`${e.evaluation}::numeric`.as("evaluation"),
                ]),
              );
            },
            this.db.selectNoFrom([
              sql<string>`${evaluations[0].id}::uuid`.as("id"),
              sql<number>`${evaluations[0].evaluation}::numeric`.as(
                "evaluation",
              ),
            ]),
          )
          .as("data_table"),
      )
      .set((eb) => ({
        evaluation: eb.ref("data_table.evaluation"),
      }))
      .whereRef("predictions.id", "=", "data_table.id")
      .execute();
  }
}
