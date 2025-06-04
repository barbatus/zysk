import {
  type EvaluationDetails,
  type Experiment,
  type PredictionInsert,
  SentimentEnum,
} from "@zysk/db";
import { ExperimentService, PredictionService, resolve } from "@zysk/services";
import { omit } from "lodash";

import { type AgentExecutionResult } from "#/llm/core/schemas";

import { ModelKeyEnum } from "../core/enums";
import { modelsWithFallback } from "../models/registry";
import { ExperimentAgent } from "./experiment.agent";
import { type Prediction } from "./prompts/prediction-parser";
import { PredictionsMergerPrompt } from "./prompts/predictions-merger.prompt";

const experimentService = resolve(ExperimentService);
const predictionService = resolve(PredictionService);

export class PredictorAgent extends ExperimentAgent<
  Prediction,
  PredictionInsert
> {
  private readonly predictions: Prediction[];
  private readonly symbol: string;
  private readonly currentDate: Date;

  constructor(params: {
    symbol: string;
    state: Experiment;
    predictions: Prediction[];
    currentDate: Date;
  }) {
    super(
      params.state,
      PredictionsMergerPrompt,
      modelsWithFallback[ModelKeyEnum.GptO3Mini],
    );
    this.predictions = params.predictions;
    this.symbol = params.symbol;
    this.currentDate = params.currentDate;
  }

  override async mapPromptValues(): Promise<Record<string, string>> {
    return {
      predictions: this.predictions
        .map((p) => `\`\`\`json\n${JSON.stringify(p, null, 2)}\`\`\``)
        .join("\n"),
      symbol: this.symbol,
    };
  }

  override async arun(
    promptValues: Record<string, string>,
  ): Promise<AgentExecutionResult<Prediction>> {
    if (this.predictions.length === 1) {
      return {
        response: this.predictions[0],
        evaluationDetails: {} as EvaluationDetails,
      };
    }
    return await super.arun(promptValues);
  }

  static override readonly modelKey = ModelKeyEnum.GptO3Mini;

  static override async create(params: {
    symbol: string;
    predictions: Prediction[];
    currentDate: Date;
  }) {
    const state = await experimentService.create();
    return new PredictorAgent({
      state,
      ...params,
    });
  }

  override async setSuccess(result: AgentExecutionResult<Prediction>) {
    await experimentService.setSuccess(
      this.state.id,
      this.model.name,
      result.response as string | object,
      result.evaluationDetails,
      2,
    );
    const finalPrediction = this.evalPrediction(result.response);
    await predictionService.saveSymbolPrediction(this.symbol, {
      ...finalPrediction,
      experimentId: this.state.id,
      period: this.currentDate,
    });
    return finalPrediction;
  }

  private evalSentiment(
    experimentResponse: Prediction,
  ): [SentimentEnum, number] {
    const getSentiment = (): [SentimentEnum, number] => {
      if (
        experimentResponse.prediction === "bearish" &&
        experimentResponse.confidence >= 91
      ) {
        return [SentimentEnum.Bearish, experimentResponse.confidence];
      }

      if (
        experimentResponse.prediction === "bullish" &&
        experimentResponse.confidence >= 91
      ) {
        return [SentimentEnum.Bullish, experimentResponse.confidence];
      }

      if (
        experimentResponse.prediction === "bullish" &&
        experimentResponse.confidence >= 80
      ) {
        return [SentimentEnum.LikelyBullish, experimentResponse.confidence];
      }

      if (
        experimentResponse.prediction === "bearish" &&
        experimentResponse.confidence >= 80
      ) {
        return [SentimentEnum.LikelyBearish, experimentResponse.confidence];
      }

      return [SentimentEnum.Neutral, experimentResponse.confidence];
    };

    const [sentiment, confidence] = getSentiment();

    if (experimentResponse.counterSignal) {
      if (
        sentiment === SentimentEnum.Bearish &&
        experimentResponse.counterSignal.confidence >
          experimentResponse.confidence
      ) {
        return [SentimentEnum.LikelyBearish, 90];
      }

      if (
        sentiment === SentimentEnum.Bullish &&
        experimentResponse.counterSignal.confidence >
          experimentResponse.confidence
      ) {
        return [SentimentEnum.LikelyBullish, 90];
      }

      if (
        sentiment === SentimentEnum.LikelyBearish &&
        experimentResponse.counterSignal.confidence >
          experimentResponse.confidence
      ) {
        return [SentimentEnum.Neutral, 80];
      }

      if (
        sentiment === SentimentEnum.LikelyBullish &&
        experimentResponse.counterSignal.confidence >
          experimentResponse.confidence
      ) {
        return [SentimentEnum.Neutral, 80];
      }
    }

    return [sentiment, confidence];
  }

  private evalPrediction(prediction: Prediction) {
    const [sentiment, confidence] = this.evalSentiment(prediction);
    const isNegative =
      sentiment === SentimentEnum.Bearish ||
      sentiment === SentimentEnum.LikelyBearish;
    const insights = prediction.newsInsights.toSorted((a, b) => {
      if (isNegative && a.impact !== b.impact) {
        return a.impact === "positive" ? 1 : -1;
      }

      if (!isNegative && a.impact !== b.impact) {
        return a.impact === "negative" ? 1 : -1;
      }

      return b.confidence - a.confidence;
    });
    const predictionResponse = {
      ...omit(prediction, "newsInsights"),
      prediction: sentiment,
      confidence,
      insights,
    };

    return {
      symbol: this.symbol,
      confidence,
      responseJson: predictionResponse,
      prediction: sentiment,
      period: this.currentDate,
    };
  }
}
