import { type DataDatabase } from "@zysk/db";
import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import { type AppConfig } from "../config";

export function createDb(config: AppConfig) {
  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString: `postgresql://${config.postgres.username}:${config.postgres.password}@${config.postgres.host}:${config.postgres.port}/${config.postgres.database}`,
      max: 50,
    }),
  });
  return new Kysely<DataDatabase>({
    dialect,
    plugins: [new CamelCasePlugin()],
  });
}

export const dbSymbol: symbol = Symbol.for("DataDB");
