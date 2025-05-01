import { type ColumnType, type Selectable } from "kysely";

export interface IalphaVantageCompanyOverview {
  symbol: string;
  description: string;
  sector: string;
  country: string;
  beta: number | null;
}

export interface IalphaVantageETFProfile {
  symbol: string;
  inception_date: ColumnType<Date | null, string | undefined>;
  sectors: {
    name: string;
    weight: number;
  }[];
}

export interface IalphaVantageTimeSeries {
  symbol: string;
  openPrice: number;
  closePrice: number;
  high: number;
  low: number;
  volume: number;
  date: Date;
}

export interface Database {
  "api_data.alphaVantageCompanyOverview": IalphaVantageCompanyOverview;
  "api_data.alphaVantageEtfProfile": IalphaVantageETFProfile;
  "api_data.alphaVantageTimeSeries": IalphaVantageTimeSeries;
}

export type AlphaVantageCompanyOverview =
  Selectable<IalphaVantageCompanyOverview>;

export type AlphaVantageETFProfile = Selectable<IalphaVantageETFProfile>;

export type AlphaVantageTimeSeries = Selectable<IalphaVantageTimeSeries>;
