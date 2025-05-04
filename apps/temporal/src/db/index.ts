import "dotenv/config";

import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import { appConfig } from "../config";
import { type Database } from "./schema/kysely";

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: `postgresql://${appConfig.postgres.username}:${appConfig.postgres.password}@${appConfig.postgres.host}:${appConfig.postgres.port}/${appConfig.postgres.database}`,
    max: 50,
  }),
});

export const db = new Kysely<Database>({
  dialect,
  plugins: [new CamelCasePlugin()],
});
