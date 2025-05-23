import { type Experiment, type PredictionModel } from "@zysk/db";
import { ExperimentService, resolve } from "@zysk/services";

import { type AbstractContainer } from "../core/base";
import { ModelKeyEnum } from "../core/enums";
import { modelsWithFallback } from "../models/registry";
import { type AgentPrompt, ExperimentAgent } from "./experiment.agent";
import {
  nextWeekGeneralMarketPredictionPrompt,
  nextWeekTicketMarketPredictionPrompt,
} from "./prompts/next-week-prediction.prompt";
import { type Prediction } from "./prompts/prediction-parser";

const experimentService = resolve(ExperimentService);
interface NewsBasedSymbolPredictorParams {
  state: Experiment;
  symbol: string;
  prompt: AgentPrompt<Prediction>;
  model: AbstractContainer;
  news: { markdown: string; url: string; date: Date }[];
}

export class NewsBasedSymbolMarketPredictorAgent extends ExperimentAgent<
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
    super(params.state, params.prompt, params.model);
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
  }) {
    const state = await experimentService.create();
    return new NewsBasedSymbolMarketPredictorAgent({
      state,
      ...params,
      prompt: params.prompt as AgentPrompt<Prediction>,
      model: params.model ?? modelsWithFallback[ModelKeyEnum.GptO3Mini]!,
    });
  }
}

export class NewsBasedTickerMarketPredictorAgent extends NewsBasedSymbolMarketPredictorAgent {
  private readonly marketPrediction: PredictionModel["responseJson"];
  private readonly timeSeries: { date: Date; closePrice: number }[];

  constructor(
    params: NewsBasedSymbolPredictorParams & {
      marketPrediction: PredictionModel["responseJson"];
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
        .map((t) => `${new Date(t.date).toISOString()}: ${t.closePrice}`)
        .join("\n"),
    };
  }
}

export class NextWeekNewsBasedPredictorAgent extends ExperimentAgent<
  Prediction,
  Prediction
> {
  static override async create(params: {
    symbol: string;
    news: { markdown: string; url: string; date: Date }[];
    marketPrediction: PredictionModel["responseJson"];
    timeSeries: { date: Date; closePrice: number }[];
  }) {
    const state = await experimentService.create();
    return new NewsBasedTickerMarketPredictorAgent({
      state,
      ...params,
      prompt: nextWeekTicketMarketPredictionPrompt,
      model: modelsWithFallback[ModelKeyEnum.GptO3Mini]!,
    });
  }
}

export class NextWeekMarketPredictionAgent extends ExperimentAgent<
  Prediction,
  Prediction
> {
  static override async create(params: {
    news: { markdown: string; url: string; date: Date }[];
  }) {
    const state = await experimentService.create();
    return new NewsBasedSymbolMarketPredictorAgent({
      state,
      ...params,
      symbol: "GENERAL",
      prompt: nextWeekGeneralMarketPredictionPrompt,
      model: modelsWithFallback[ModelKeyEnum.GptO3Mini]!,
    });
  }
}
