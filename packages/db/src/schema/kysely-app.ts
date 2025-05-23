import {
  type ColumnType,
  type Generated,
  type Insertable,
  type JSONColumnType,
  type Selectable,
} from "kysely";

import { type CreateTableType, type Optional } from "../utils/custom-types";
import { type predictionsTable } from "./predictions";
import { type quotesTable } from "./quotes";
import { type subscriptionsTable } from "./subscriptions";
import { type tickersTable, type userTickersTable } from "./tickers";

export interface UsersTable {
  id: Generated<string>;
  firstName: string;
  lastName: string | null;
  email: string;
}

export type TickerType = "stock" | "etp" | "reit" | "adr";

type TickersTableBase = typeof tickersTable.$inferSelect;
export type TickersTable = CreateTableType<
  TickersTableBase,
  {
    sectors: JSONColumnType<
      {
        name: string;
        weight: number;
      }[]
    >;
    foundedAt: ColumnType<Date | null, Optional<Date>>;
  }
>;

type UserTickersTableBase = typeof userTickersTable.$inferSelect;
export type UserTickersTable = CreateTableType<
  UserTickersTableBase,
  {
    openedAt: ColumnType<Date, string, never>;
    closedAt: ColumnType<Date, string, never>;
    amount: ColumnType<number, string | number>;
    openPrice: ColumnType<number, string | number>;
    closePrice: ColumnType<number, string | number>;
  }
>;

type TickerQuotesTableBase = typeof quotesTable.$inferSelect;
export type TickerQuotesTable = CreateTableType<
  TickerQuotesTableBase,
  {
    date: ColumnType<Date, string | Date>;
    openPrice: ColumnType<number, string | number>;
    closePrice: ColumnType<number, string | number>;
    high: ColumnType<number, string | number>;
    low: ColumnType<number, string | number>;
    volume: ColumnType<number, string | number>;
    splitCoeff: ColumnType<number, string | number | null>;
    divident: ColumnType<number, string | number | null>;
  }
>;

type SubscriptionsTableBase = typeof subscriptionsTable.$inferSelect;
export type SubscriptionsTable = CreateTableType<SubscriptionsTableBase>;

type PredictionsTableBase = typeof predictionsTable.$inferSelect;
export type PredictionsTable = CreateTableType<
  PredictionsTableBase,
  {
    confidence: ColumnType<number, string | number>;
  }
>;

export interface Database {
  users: UsersTable;
  tickers: TickersTable;
  userTickers: UserTickersTable;
  tickerQuotes: TickerQuotesTable;
  subscriptions: SubscriptionsTable;
  predictions: PredictionsTable;
}

export type User = Selectable<UsersTable>;
export type Ticker = Selectable<TickersTable>;
export type UserTicker = Selectable<UserTickersTable>;
export type TickerQuote = Selectable<TickerQuotesTable>;
export type Subscription = Selectable<SubscriptionsTable>;
export type Prediction = Selectable<PredictionsTable>;
export type PredictionModel = Insertable<PredictionsTable>;
