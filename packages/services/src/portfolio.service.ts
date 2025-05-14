import { type Database } from "@zysk/db";
import { type Position } from "@zysk/ts-rest";
import { inject } from "inversify";
import { type Kysely } from "kysely";

import { appDBSymbol } from "./db";

export class PortfolioService {
  constructor(@inject(appDBSymbol) private db: Kysely<Database>) {}

  async getPositions(): Promise<Position[]> {
    return this.db.selectFrom("userTickers").selectAll().execute();
  }
}
