import { ExperimentService, ModelKeyEnum, resolve } from "@zysk/services";

import { modelsWithFallback } from "../models/registry";
import { ExperimentRunner } from "./experimenter";
import { type NewsBasedExperimentParams } from "./news-based-sentiment-predictor";
import { NewsInsightsExtractorPrompt } from "./prompts/insights-extractor.prompt";
import { type Insights } from "./prompts/insights-parser";
import { type AgentExecutionResult } from "#/llm/core/schemas";

export class NewsInsightsExtractor extends ExperimentRunner<
  Insights,
  Insights
> {
  private readonly news: {
    id: string;
    symbol: string;
    markdown: string;
    newsDate: Date;
    url: string;
  }[];
  private readonly indexToUuid: Map<number, string> = new Map();

  constructor(
    params: Omit<NewsBasedExperimentParams<Insights>, "symbol" | "currentDate" | "newsInsights"> & {
      news: { id: string; markdown: string; url: string; newsDate: Date; symbol: string }[]
    },
  ) {
    super(params.state, params.prompt, params.model, params.onHeartbeat);
    this.news = params.news;
  }

  override async mapPromptValues(): Promise<Record<string, string>> {
    for (const [index, n] of this.news.entries()) {
      this.indexToUuid.set(index, n.id);
    }
    return {
      news: this.news
        .map(
          (n, index) =>
            `# ARTICLE FOR: ${n.symbol}, ID: ${index}, TITLE: ${n.newsDate.toISOString()}, DATE: ${n.newsDate.toISOString()}, URL: \`${n.url}\`:\n${n.markdown}`,
        )
        .join("\n---\n"),
    };
  }

  override async setSuccess(result: AgentExecutionResult<Insights>) {
    const insights = result.response as Insights;
    const values = insights.map((i, index) => ({
      ...i,
      acticleId: this.indexToUuid.get(index)!,
    }));
    return super.setSuccess({
      ...result,
      response: values,
    });
  }

  static override readonly modelKey = ModelKeyEnum.GeminiFlash25;

  static override async create(params: {
    experimentId?: string;
    news: { id: string; markdown: string; url: string; newsDate: Date; symbol: string }[];
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
