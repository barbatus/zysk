import {
  type ColumnType,
  type Generated,
  type JSONColumnType,
  type Selectable,
} from "kysely";

import { type predictionsTable } from "./predictions";
import { type subscriptionsTable } from "./subscriptions";

export interface UsersTable {
  id: Generated<string>;
  firstName: string;
  lastName: string | null;
  email: string;
}

export type TickerType = "stock" | "etp" | "reit" | "adr";

export interface TickersTable {
  symbol: string;
  type: TickerType;
  currency: string;
  figi: string | null;
  about: string;
  sectors: JSONColumnType<
    {
      name: string;
      weight: number;
    }[]
  >;
  foundedAt: ColumnType<Date | null, string | undefined>;
}

export interface UserTickersTable {
  id: Generated<string>;
  userId: string;
  symbol: string;
  amount: number;
  openedAt: ColumnType<Date, string, never>;
  openPrice: number | null;
  closedAt: ColumnType<Date, string, never>;
  closePrice: number | null;
}

export interface TickerQuotesTable {
  symbol: string;
  openPrice: number;
  closePrice: number;
  high: number;
  low: number;
  volume: number;
  splitCoeff: number | null;
  divident: number | null;
  date: Date;
}

type SubscriptionsTableBase = typeof subscriptionsTable.$inferSelect;
export interface SubscriptionsTable extends Omit<SubscriptionsTableBase, "id"> {
  id: Generated<string>;
}

type PredictionsTableBase = typeof predictionsTable.$inferSelect;
export interface PredictionsTable extends Omit<PredictionsTableBase, "id"> {
  id: Generated<string>;
}

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
