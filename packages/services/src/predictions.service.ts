import { type DataDatabase } from "@zysk/db";
import { inject, injectable } from "inversify";
import { type Kysely } from "kysely";

import { dataDBSymbol } from "./db";

@injectable()
export class PredictionService {
  constructor(@inject(dataDBSymbol) private readonly db: Kysely<DataDatabase>) {
    console.log(this.db);
  }
}
