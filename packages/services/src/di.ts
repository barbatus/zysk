import { type DataDatabase } from "@zysk/db";
import { Container } from "inversify";
import { type Kysely } from "kysely";

import { AlphaVantageService } from "./alpha-vantage.service";
import { type AppConfig, appConfigSymbol, getAppConfigStatic } from "./config";
import { createDb, dbSymbol } from "./db";
import { ExperimentService } from "./experiment.service";
import { FinnhubService } from "./finnhub.service";
import { TickerNewsService } from "./ticker-news.service";
import { TickerInfoService } from "./ticket-info.service";
import { createLogger, type Logger, loggerSymbol } from "./utils/logger";

export const container = new Container();

container.bind(appConfigSymbol).toConstantValue(getAppConfigStatic());

container
  .bind<Kysely<DataDatabase>>(dbSymbol)
  .toResolvedValue(createDb, [appConfigSymbol])
  .inSingletonScope();

container
  .bind<Logger>(loggerSymbol)
  .toResolvedValue(createLogger, [appConfigSymbol])
  .inSingletonScope();

const services = [
  AlphaVantageService,
  TickerInfoService,
  TickerNewsService,
  FinnhubService,
  ExperimentService,
] as const;

services.forEach((service) => {
  container.bind<typeof service>(service).toSelf().inSingletonScope();
});

export function resolve<T extends (typeof services)[number]>(
  service: T,
): InstanceType<T> {
  return container.get<InstanceType<T>>(service);
}

export function getConfig(): AppConfig {
  return container.get<AppConfig>(appConfigSymbol);
}

export function getLogger(): Logger {
  return container.get<Logger>(loggerSymbol);
}
