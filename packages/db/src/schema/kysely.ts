import {
  type ColumnType,
  type Generated,
  type JSONColumnType,
  type Selectable,
} from "kysely";

export interface UserTable {
  id: Generated<string>;
  first_name: string;
  last_name: string | null;
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
  founded_at: ColumnType<Date | null, string, string>;
}

export interface UserTickersTable {
  user_id: string;
  symbol: string;
  amount: number;
  opened_at: ColumnType<Date, string, never>;
  open_price: number | null;
  closed_at: ColumnType<Date, string, never>;
  close_price: number | null;
}

export interface Quote {
  symbol: string;
  open_price: number;
  close_price: number;
  high: number;
  low: number;
  volume: number;
  split_coeff: number | null;
  divident: number | null;
  date: Date;
}

export interface Database {
  user: UserTable;
  ticker: TickerTable;
  user_tickers: UserTickersTable;
  quote: Quote;
}

export type User = Selectable<UserTable>;
export type Ticker = Selectable<TickerTable>;
export type UserTickers = Selectable<UserTickersTable>;
