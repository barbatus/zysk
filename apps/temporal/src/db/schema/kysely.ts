import { type ColumnType, type Generated, type Selectable } from "kysely";

import {
  type EvaluationDetails,
  type ExperimentTaskStatus,
} from "./experiments";

export interface IalphaVantageCompanyOverviews {
  symbol: string;
  description: string;
  sector: string;
  country: string;
  beta: number | null;
}

export interface IalphaVantageETFProfiles {
  symbol: string;
  inceptionDate: ColumnType<Date | null, string | undefined>;
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

export interface Iexperiment {
  id: Generated<string>;
  responseText: string | null;
  responseJson: object | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
  status: ExperimentTaskStatus;
  details: EvaluationDetails | null;
}

export interface Database {
  "app_data.alphaVantageCompanyOverviews": IalphaVantageCompanyOverviews;
  "app_data.alphaVantageETFProfiles": IalphaVantageETFProfiles;
  "app_data.alphaVantageTimeSeries": IalphaVantageTimeSeries;
  "app_data.experiments": Iexperiment;
}

export type AlphaVantageCompanyOverviews =
  Selectable<IalphaVantageCompanyOverviews>;

export type AlphaVantageETFProfiles = Selectable<IalphaVantageETFProfiles>;

export type AlphaVantageTimeSeries = Selectable<IalphaVantageTimeSeries>;

export type Experiment = Selectable<Iexperiment>;
