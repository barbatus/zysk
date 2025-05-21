import { type Experiment } from "@zysk/db";
import { ExperimentService, resolve } from "@zysk/services";

import { type AgentExecutionResult } from "#/llm/core/schemas";

import { type AbstractContainer } from "../core/base";
import { ModelKeyEnum } from "../core/enums";
import { modelsWithFallback } from "../models/registry";
import { type AgentPrompt, ExperimentAgent } from "./experiment.agent";
import {
  nextWeekGeneralMarketPredictionPrompt,
  nextWeekTicketMarketPredictionPrompt,
} from "./prompts/next-week-prediction.prompt";
import { type Prediction } from "./prompts/prediction-parser";
import { predictionsMergerPrompt } from "./prompts/predictions-merger.prompt";

const experimentService = resolve(ExperimentService);

interface NewsBasedSymbolPredictorParams {
  state: Experiment;
  symbol: string;
  prompt: AgentPrompt<Prediction>;
  model: AbstractContainer;
  news: { markdown: string; url: string; date: Date }[];
}

export class NewsBasedSymbolMarketPredictorAgent extends ExperimentAgent<Prediction> {
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
  private readonly marketPrediction: Prediction;

  constructor(
    params: NewsBasedSymbolPredictorParams & {
      marketPrediction: Prediction;
    },
  ) {
    super(params);
    this.marketPrediction = params.marketPrediction;
  }

  override async mapPromptValues(): Promise<Record<string, string>> {
    return {
      ...(await super.mapPromptValues()),
      marketPrediction: JSON.stringify(this.marketPrediction),
    };
  }
}

export class NextWeekNewsBasedPredictorAgent extends ExperimentAgent<Prediction> {
  static override async create(params: {
    symbol: string;
    news: { markdown: string; url: string; date: Date }[];
    marketPrediction: Prediction;
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

export class NextWeekMarketPredictionAgent extends ExperimentAgent<Prediction> {
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

export class PredictionsMergerAgent extends ExperimentAgent<Prediction> {
  private readonly predictions: Prediction[];

  constructor(params: { state: Experiment; predictions: Prediction[] }) {
    super(
      params.state,
      predictionsMergerPrompt,
      modelsWithFallback[ModelKeyEnum.GptO3Mini],
    );
    this.predictions = params.predictions;
  }

  override async mapPromptValues(): Promise<Record<string, string>> {
    return {
      predictions: this.predictions
        .map((p) => `\`\`\`json\n${JSON.stringify(p, null, 2)}\`\`\``)
        .join("\n"),
    };
  }

  static override async create(params: { predictions: Prediction[] }) {
    const state = await experimentService.create();
    return new PredictionsMergerAgent({
      state,
      predictions: params.predictions,
    });
  }

  override async setSuccess(result: AgentExecutionResult<Prediction>) {
    await experimentService.setSuccess(
      this.state.id,
      result.response as string | object,
      result.evaluationDetails,
      2,
    );
    return result.response;
  }
}
