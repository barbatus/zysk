import {
  type ColumnType,
  type Generated,
  type JSONColumnType,
  type Selectable,
} from "kysely";

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

export interface Database {
  users: UsersTable;
  tickers: TickersTable;
  userTickers: UserTickersTable;
  tickerQuotes: TickerQuotesTable;
}

export type Users = Selectable<UsersTable>;
export type Tickers = Selectable<TickersTable>;
export type UserTickers = Selectable<UserTickersTable>;
export type TickerQuotes = Selectable<TickerQuotesTable>;
