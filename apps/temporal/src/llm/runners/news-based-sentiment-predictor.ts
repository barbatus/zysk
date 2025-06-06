import { type Experiment } from "@zysk/db";
import { ExperimentService, ModelKeyEnum, resolve } from "@zysk/services";
import { format } from "date-fns";

import { type AbstractContainer } from "../core/base";
import { modelsWithFallback } from "../models/registry";
import { type ExperimentPrompt, ExperimentRunner } from "./experimenter";
import { type Prediction } from "./prompts/prediction-parser";
import {
  GeneralMarketSentimentPredictionPrompt,
  TickerSentimentPredictionPrompt,
} from "./prompts/sentiment-prediction.prompt";

export interface NewsBasedExperimentParams<TResult = Prediction> {
  state: Experiment;
  symbol: string;
  prompt: ExperimentPrompt<TResult>;
  model: AbstractContainer;
  news: { id: string; markdown: string; url: string; newsDate: Date }[];
  currentDate: Date;
  onHeartbeat?: () => Promise<void>;
}

class NewsBasedSentimentPredictor extends ExperimentRunner<
  Prediction,
  Prediction
> {
  private readonly symbol: string;
  private readonly news: {
    markdown: string;
    newsDate: Date;
    url: string;
  }[];
  private readonly currentDate: Date;

  constructor(params: NewsBasedExperimentParams) {
    super(params.state, params.prompt, params.model, params.onHeartbeat);
    this.symbol = params.symbol;
    this.news = params.news;
    this.currentDate = params.currentDate;
  }

  override async mapPromptValues(): Promise<Record<string, string>> {
    return {
      symbol: this.symbol,
      news: this.news
        .map(
          (n) =>
            `# ARTICLE TITLE: ${n.newsDate.toISOString()}, DATE: ${n.newsDate.toISOString()}, URL: ${n.url}\n${n.markdown}`,
        )
        .join("\n---\n"),
      currentDate: format(this.currentDate, "yyyy-MM-dd"),
    };
  }
}

export class TickerSentimentPredictor extends NewsBasedSentimentPredictor {
  private readonly marketPrediction: Experiment["responseJson"];
  private readonly timeSeries: { date: Date; closePrice: number }[];
  static override readonly modelKey = ModelKeyEnum.DeepSeekReasoner;

  constructor(
    params: NewsBasedExperimentParams & {
      marketPrediction: Experiment["responseJson"];
      timeSeries: { date: Date; closePrice: number }[];
    },
  ) {
    super(params);
    this.marketPrediction = params.marketPrediction;
    this.timeSeries = params.timeSeries;
  }

  override async mapPromptValues(): Promise<Record<string, string>> {
    return {
      ...(await super.mapPromptValues()),
      marketPrediction: JSON.stringify(this.marketPrediction),
      quotes: this.timeSeries
        .map((t) => `${format(t.date, "yyyy-MM-dd")}: ${t.closePrice}`)
        .join("\n"),
    };
  }

  static override async create(params: {
    symbol: string;
    news: { id: string; markdown: string; url: string; newsDate: Date }[];
    marketPrediction: Experiment["responseJson"];
    timeSeries: { date: Date; closePrice: number }[];
    currentDate: Date;
    onHeartbeat?: () => Promise<void>;
  }) {
    const experimentService = resolve(ExperimentService);
    const state = await experimentService.create();
    return new TickerSentimentPredictor({
      state,
      ...params,
      prompt: TickerSentimentPredictionPrompt,
      model: modelsWithFallback[ModelKeyEnum.DeepSeekReasoner]!,
    });
  }
}

export class MarketSentimentPredictor extends ExperimentRunner<
  Prediction,
  Prediction
> {
  static override readonly modelKey = ModelKeyEnum.GptO3Mini;

  static override async create(params: {
    currentDate: Date;
    news: { id: string; markdown: string; url: string; newsDate: Date }[];
    onHeartbeat?: () => Promise<void>;
  }) {
    const experimentService = resolve(ExperimentService);
    const state = await experimentService.create();
    return new NewsBasedSentimentPredictor({
      state,
      ...params,
      symbol: "GENERAL",
      prompt: GeneralMarketSentimentPredictionPrompt,
      model: modelsWithFallback[ModelKeyEnum.GptO3Mini]!,
    });
  }
}
