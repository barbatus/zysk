import {
  type ColumnType,
  type Generated,
  type JSONColumnType,
  type Selectable,
} from "kysely";

export interface UserTable {
  id: Generated<string>;
  firstName: string;
  lastName: string | null;
  email: string;
}

export interface TickerTable {
  symbol: string;
  type: "stock" | "etp" | "reit" | "adr";
  currency: string;
  figi: string;
  about: string | null;
  sectors: JSONColumnType<
    {
      name: string;
      weight: number;
    }[]
  >;
  foundedAt: ColumnType<Date | null, string, string>;
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

export interface Quote {
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
  user: UserTable;
  ticker: TickerTable;
  userTickers: UserTickersTable;
  quote: Quote;
}

export type User = Selectable<UserTable>;
export type Ticker = Selectable<TickerTable>;
export type UserTickers = Selectable<UserTickersTable>;
