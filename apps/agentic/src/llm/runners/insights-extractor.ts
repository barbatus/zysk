import { ExperimentService, resolve } from "@zysk/services";

import { type AgentExecutionResult } from "#/llm/core/schemas";

import {
  ModelKeyEnumWithFallback,
  modelsWithFallback,
} from "../models/registry";
import { ExperimentRunner } from "./experimenter";
import { type NewsBasedExperimentParams } from "./news-based-sentiment-predictor";
import { NewsInsightsExtractorPrompt } from "./prompts/insights-extractor.prompt";
import { type Insights } from "./prompts/insights-parser";

interface NewsArticle {
  id: string;
  symbol?: string;
  markdown: string;
  newsDate: Date;
  url: string;
}

export class NewsInsightsExtractor extends ExperimentRunner<
  Insights,
  Insights
> {
  private readonly news: NewsArticle[];
  private readonly sectors: string[];
  private readonly indexToUuid = new Map<number, string>();

  constructor(
    params: Omit<
      NewsBasedExperimentParams<Insights>,
      "symbol" | "currentDate" | "newsInsights"
    > & {
      news: NewsArticle[];
      sectors: string[];
    },
  ) {
    super(params.state, params.prompt, params.model, params.onHeartbeat);
    this.news = params.news;
    this.sectors = params.sectors;
  }

  override async mapPromptValues(): Promise<Record<string, string>> {
    for (const [index, n] of this.news.entries()) {
      this.indexToUuid.set(index, n.id);
    }
    return {
      news: this.news
        .map(
          (n, index) =>
            `# ARTICLE ${n.symbol ? `FOR: ${n.symbol}` : ""}, ID: ${index}, TITLE: ${n.newsDate.toISOString()}, DATE: ${n.newsDate.toISOString()}, URL: \`${n.url}\`:\n${n.markdown}`,
        )
        .join("\n---\n"),
      sectors: this.sectors.join("\n"),
    };
  }

  override async setSuccess(result: AgentExecutionResult<Insights>) {
    const insights = result.response;
    const values = insights.map((i, index) => ({
      ...i,
      acticleId: this.indexToUuid.get(index)!,
    }));
    return super.setSuccess({
      ...result,
      response: values,
    });
  }

  static override readonly modelKey =
    ModelKeyEnumWithFallback.GeminiFlash25AndO3Mini;

  static override async create(params: {
    experimentId?: string;
    news: NewsArticle[];
    sectors: string[];
    onHeartbeat?: () => Promise<void>;
  }) {
    const experimentService = resolve(ExperimentService);
    const state = await experimentService.create({
      experimentId: params.experimentId,
    });
    return new NewsInsightsExtractor({
      state,
      ...params,
      prompt: NewsInsightsExtractorPrompt,
      model: modelsWithFallback[this.modelKey]!,
      onHeartbeat: params.onHeartbeat,
    });
  }
}
