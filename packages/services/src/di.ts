import { type Database, type DataDatabase } from "@zysk/db";
import { Container } from "inversify";
import Redis from "ioredis";
import { type Kysely } from "kysely";

import { AlphaVantageService } from "./alpha-vantage.service";
import { type AppConfig, appConfigSymbol, getAppConfigStatic } from "./config";
import { appDBSymbol, createDb, dataDBSymbol } from "./db";
import { ExperimentService } from "./experiment.service";
import { FinnhubService } from "./finnhub.service";
import { MetricsService } from "./metrics.service";
import { NewsInsightsService } from "./news-insights.service";
import { PortfolioService } from "./portfolio.service";
import { PredictionService } from "./prediction.service";
import { getRedisClient, redisClientSymbol } from "./redis-client";
import { StockNewsApiService } from "./stock-news-api.service";
import { TickerService } from "./ticker.service";
import { TickerDataService } from "./ticker-data.service";
import { TickerNewsService } from "./ticker-news.service";
import { createLogger, type Logger, loggerSymbol } from "./utils/logger";
import { WatchlistService } from "./watchlist.service";

export const container = new Container();

container.bind(appConfigSymbol).toResolvedValue(() => getAppConfigStatic());

container.bind(redisClientSymbol).toResolvedValue(() => getRedisClient());

container
  .bind<Kysely<DataDatabase>>(dataDBSymbol)
  .toResolvedValue(createDb, [appConfigSymbol])
  .inSingletonScope();

container
  .bind<Kysely<Database>>(appDBSymbol)
  .toResolvedValue(createDb, [appConfigSymbol])
  .inSingletonScope();

container
  .bind<Logger>(loggerSymbol)
  .toResolvedValue(createLogger, [appConfigSymbol])
  .inSingletonScope();

const services = [
  AlphaVantageService,
  TickerDataService,
  TickerNewsService,
  FinnhubService,
  ExperimentService,
  PortfolioService,
  MetricsService,
  WatchlistService,
  StockNewsApiService,
  TickerService,
  PredictionService,
  NewsInsightsService,
] as const;

services.forEach((service) => {
  container.bind<typeof service>(service).toSelf().inSingletonScope();
});

container.bind(Redis).toResolvedValue(() => getRedisClient());

export function resolve<T extends (typeof services)[number] | typeof Redis>(
  service: T,
): T extends (typeof services)[number] ? InstanceType<T> : Redis {
  return container.get<
    T extends (typeof services)[number] ? InstanceType<T> : Redis
  >(service);
}

export function getConfig(): AppConfig {
  return container.get<AppConfig>(appConfigSymbol);
}

export function getLogger(): Logger {
  return container.get<Logger>(loggerSymbol);
}
