import { type ColumnType, type Insertable, type Selectable } from "kysely";

import { type CreateTableType, type Optional } from "../utils/custom-types";
import { type experimentsTable } from "./experiments";
import { type stockNewsTable } from "./stock-news";
import {
  type companyProfiles,
  type etfProfiles,
  type tickerTimeSeries,
} from "./tickers-data";

type CompanyProfilesTableBase = typeof companyProfiles.$inferSelect;
export type CompanyProfilesTable = CreateTableType<
  CompanyProfilesTableBase,
  {
    beta: ColumnType<string, Optional<string | number>>;
  }
>;

type ETFProfilesTableBase = typeof etfProfiles.$inferSelect;
export type ETFProfilesTable = CreateTableType<
  ETFProfilesTableBase,
  {
    inceptionDate: ColumnType<Date | null, Optional<string | Date>>;
  }
>;

type TickerTimeSeriesTableBase = typeof tickerTimeSeries.$inferSelect;
export type TickerTimeSeriesTable = CreateTableType<
  TickerTimeSeriesTableBase,
  {
    date: ColumnType<Date, string | Date>;
    openPrice: ColumnType<number, string | number>;
    closePrice: ColumnType<number, string | number>;
    high: ColumnType<number, string | number>;
    low: ColumnType<number, string | number>;
    volume: ColumnType<number, string | number>;
  }
>;

type ExperimentsTableBase = typeof experimentsTable.$inferSelect;
export type ExperimentsTable = CreateTableType<ExperimentsTableBase>;

type StockNewsTableBase = typeof stockNewsTable.$inferSelect;
type StockNewsTable = CreateTableType<
  StockNewsTableBase,
  {
    newsDate: ColumnType<Date, string | Date>;
  }
>;

export interface DataDatabase {
  "app_data.company_profiles": CompanyProfilesTable;
  "app_data.etf_profiles": ETFProfilesTable;
  "app_data.ticker_time_series": TickerTimeSeriesTable;
  "app_data.experiments": ExperimentsTable;
  "app_data.stock_news": StockNewsTable;
}

export type CompanyProfile = Selectable<CompanyProfilesTable>;

export type ETFProfile = Selectable<ETFProfilesTable>;

export type TickerTimeSeries = Selectable<TickerTimeSeriesTable>;

export type Experiment = Selectable<ExperimentsTable>;

export type StockNews = Selectable<StockNewsTable>;

export type StockNewsUpdate = Insertable<StockNewsTable>;
