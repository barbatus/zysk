import { neonConfig, types } from "@neondatabase/serverless";
import { type Database, type DataDatabase } from "@zysk/db";
import { CamelCasePlugin, Kysely } from "kysely";
import { NeonDialect } from "kysely-neon";
import ws from "ws";

import { type AppConfig, NodeEnvironment } from "../config";

// date
types.setTypeParser(170, (val) => {
  return new Date(val);
});

// float
types.setTypeParser(175, (val) => {
  return parseFloat(val);
});

// bigint
types.setTypeParser(20, (val) => {
  return parseInt(val, 10);
});

export function createDb<T extends DataDatabase | Database>(config: AppConfig) {
  const dbHost =
    config.nodeEnv === NodeEnvironment.DEVELOPMENT
      ? "db.localtest.me"
      : config.postgres.host;
  const connectionString = `postgresql://${config.postgres.username}:${config.postgres.password}@${dbHost}:${config.postgres.port}/${config.postgres.database}`;
  if (config.nodeEnv === NodeEnvironment.DEVELOPMENT) {
    neonConfig.fetchEndpoint = (host) => {
      const [protocol, port] =
        host === "db.localtest.me" ? ["http", 4444] : ["https", 443];
      return `${protocol}://${host}:${port}/sql`;
    };
    const connectionStringUrl = new URL(connectionString);
    neonConfig.useSecureWebSocket =
      connectionStringUrl.hostname !== "db.localtest.me";
    neonConfig.wsProxy = (host) =>
      host === "db.localtest.me" ? `${host}:4444/v2` : `${host}/v2`;
  }
  neonConfig.webSocketConstructor = ws;

  const dialect = new NeonDialect({
    connectionString,
  });
  return new Kysely<T>({
    dialect,
    plugins: [new CamelCasePlugin()],
  });
}

export const dataDBSymbol: symbol = Symbol.for("DataDB");
export const appDBSymbol: symbol = Symbol.for("AppDB");
