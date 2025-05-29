import { type Experiment } from "@zysk/db";
import { ExperimentService, resolve } from "@zysk/services";
import { format } from "date-fns";

import { type AbstractContainer } from "../core/base";
import { ModelKeyEnum } from "../core/enums";
import { modelsWithFallback } from "../models/registry";
import { type AgentPrompt, ExperimentAgent } from "./experiment.agent";
import { type Prediction } from "./prompts/prediction-parser";
import {
  GeneralMarketSentimentPredictionPrompt,
  TickerSentimentPredictionPrompt,
} from "./prompts/sentiment-prediction.prompt";

const experimentService = resolve(ExperimentService);
interface NewsBasedSymbolPredictorParams {
  state: Experiment;
  symbol: string;
  prompt: AgentPrompt<Prediction>;
  model: AbstractContainer;
  news: { markdown: string; url: string; date: Date }[];
  onHeartbeat?: () => Promise<void>;
}

export class NewsBasedSentimentPredictorAgent extends ExperimentAgent<
  Prediction,
  Prediction
> {
  private readonly symbol: string;
  private readonly news: {
    markdown: string;
    date: Date;
    url: string;
  }[];

  constructor(params: NewsBasedSymbolPredictorParams) {
    super(params.state, params.prompt, params.model, params.onHeartbeat);
    this.symbol = params.symbol;
    this.news = params.news;
  }

  override async mapPromptValues(): Promise<Record<string, string>> {
    return {
      symbol: this.symbol,
      news: this.news
        .map(
          (n) =>
            `# ARTICLE TITLE: ${n.date.toISOString()}, DATE: ${n.date.toISOString()}, URL: ${n.url}\n${n.markdown}`,
        )
        .join("\n---\n"),
    };
  }

  static override async create<TResult = Prediction>(params: {
    symbol: string;
    prompt: AgentPrompt<TResult>;
    model?: AbstractContainer;
    news: { markdown: string; url: string; date: Date }[];
    onHeartbeat?: () => Promise<void>;
  }) {
    const state = await experimentService.create();
    return new NewsBasedSentimentPredictorAgent({
      state,
      ...params,
      prompt: params.prompt as AgentPrompt<Prediction>,
      model: params.model ?? modelsWithFallback[ModelKeyEnum.GptO3Mini]!,
      onHeartbeat: params.onHeartbeat,
    });
  }
}

export class NewsBasedTickerSentimentPredictor extends NewsBasedSentimentPredictorAgent {
  private readonly marketPrediction: Experiment["responseJson"];
  private readonly timeSeries: { date: Date; closePrice: number }[];

  constructor(
    params: NewsBasedSymbolPredictorParams & {
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
}

export class SentimentPredictor extends ExperimentAgent<
  Prediction,
  Prediction
> {
  static override async create(params: {
    symbol: string;
    news: { markdown: string; url: string; date: Date }[];
    marketPrediction: Experiment["responseJson"];
    timeSeries: { date: Date; closePrice: number }[];
    onHeartbeat?: () => Promise<void>;
  }) {
    const state = await experimentService.create();
    return new NewsBasedTickerSentimentPredictor({
      state,
      ...params,
      prompt: TickerSentimentPredictionPrompt,
      model: modelsWithFallback[ModelKeyEnum.GptO3Mini]!,
    });
  }
}

export class MarketSentimentPredictor extends ExperimentAgent<
  Prediction,
  Prediction
> {
  static override async create(params: {
    news: { markdown: string; url: string; date: Date }[];
    onHeartbeat?: () => Promise<void>;
  }) {
    const state = await experimentService.create();
    return new NewsBasedSentimentPredictorAgent({
      state,
      ...params,
      symbol: "GENERAL",
      prompt: GeneralMarketSentimentPredictionPrompt,
      model: modelsWithFallback[ModelKeyEnum.GptO3Mini]!,
    });
  }
}
