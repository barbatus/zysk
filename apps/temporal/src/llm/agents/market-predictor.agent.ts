import { type Experiment } from "@zysk/db";

import { experimentService } from "#/services/experiment.service";

import { type AbstractContainer } from "../core/base";
import { ModelKeyEnum } from "../core/enums";
import { modelsWithFallback } from "../models/registry";
import { type AgentPrompt, ExperimentAgent } from "./experiment.agent";
import {
  type Prediction,
  shortTermPredictionPrompt,
} from "./prompts/short-term-prediction.prompt";

export class NewsBasedTickerMarketPredictorAgent extends ExperimentAgent<Prediction> {
  private readonly symbol: string;
  private readonly news: { markdown: string; date: Date; url: string }[];

  constructor(params: {
    state: Experiment;
    symbol: string;
    prompt: AgentPrompt<Prediction>;
    model: AbstractContainer;
    news: { markdown: string; url: string; date: Date }[];
  }) {
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
      marketPrognosis: "",
    };
  }

  static override async create(params: {
    symbol: string;
    news: { markdown: string; url: string; date: Date }[];
  }) {
    const state = await experimentService.create();
    return new NewsBasedTickerMarketPredictorAgent({
      state,
      symbol: params.symbol,
      prompt: shortTermPredictionPrompt,
      model: modelsWithFallback[ModelKeyEnum.GptO3Mini]!,
      news: params.news,
    });
  }
}
