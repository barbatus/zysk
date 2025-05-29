import {
  type ColumnType,
  type Generated,
  type Insertable,
  type JSONColumnType,
  type Selectable,
} from "kysely";

import { type CreateTableType, type Optional } from "../utils/custom-types";
import { type predictionsTable } from "./predictions";
import { type currentQuotesTable } from "./quotes";
import { type subscriptionsTable } from "./subscriptions";
import { type tickersTable, type userTickersTable } from "./tickers";

export interface UsersTable {
  id: Generated<string>;
  firstName: string;
  lastName: string | null;
  email: string;
}

type TickersTableBase = typeof tickersTable.$inferSelect;
export type TickersTable = CreateTableType<
  TickersTableBase,
  {
    sectors: JSONColumnType<
      | {
          name: string;
          weight: number;
        }[]
      | null,
      Optional<
        {
          name: string;
          weight: number;
        }[]
      >
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

type SubscriptionsTableBase = typeof subscriptionsTable.$inferSelect;
export type SubscriptionsTable = CreateTableType<SubscriptionsTableBase>;

type PredictionsTableBase = typeof predictionsTable.$inferSelect;
export type PredictionsTable = CreateTableType<
  PredictionsTableBase,
  {
    confidence: ColumnType<number, string | number>;
  }
>;

type CurrentQuotesTableBase = typeof currentQuotesTable.$inferSelect;
export type CurrentQuotesTable = CreateTableType<
  CurrentQuotesTableBase,
  {
    price: ColumnType<number, string | number>;
  }
>;

export interface Database {
  users: UsersTable;
  tickers: TickersTable;
  userTickers: UserTickersTable;
  subscriptions: SubscriptionsTable;
  predictions: PredictionsTable;
  currentQuotes: CurrentQuotesTable;
}

export type User = Selectable<UsersTable>;
export type Ticker = Selectable<TickersTable>;
export type UserTicker = Selectable<UserTickersTable>;
export type Subscription = Selectable<SubscriptionsTable>;
export type Prediction = Selectable<PredictionsTable>;
export type PredictionInsert = Insertable<PredictionsTable>;
