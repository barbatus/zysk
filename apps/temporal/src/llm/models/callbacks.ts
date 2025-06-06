import { UpstashRatelimitError } from "@langchain/community/callbacks/handlers/upstash_ratelimit";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { type Serialized } from "@langchain/core/load/serializable";
import { AIMessage } from "@langchain/core/messages";
import { type Generation, type LLMResult } from "@langchain/core/outputs";
import { getLogger, ModelKeyEnum } from "@zysk/services";
import dedent from "dedent";
import { APIConnectionTimeoutError, type APIError } from "openai";

import {
  InternalLLMError,
  InvalidPromptError,
  PromptTooLongError,
  QuotaExceededError,
  RateLimitExceededError,
  ResponseTimeoutError,
} from "../core/exceptions";

const logger = getLogger();

interface UsageMetadata {
  total_tokens: number;
  output_tokens: number;
  input_tokens: number;
  input_token_details?: {
    cache_read?: number;
  };
  output_token_details?: {
    reasoning?: number;
  };
}

interface ResponseMetadata {
  model_name?: string;
}

interface ChatGeneration extends Generation {
  readonly type: "chat";
  message: {
    readonly type: "ai";
    usage_metadata?: UsageMetadata;
    response_metadata?: ResponseMetadata;
  };
}

const openAIPricing1M = {
  [ModelKeyEnum.GptO3Mini]: {
    prompt: 1.1,
    cachedPrompt: 0.55,
    completion: 4.4,
  },
} as Record<
  ModelKeyEnum,
  { prompt: number; cachedPrompt: number; completion: number }
>;

export class CostCallbackHandler extends BaseCallbackHandler {
  readonly name = "OpenAICallbackHandler";
  totalTokens = 0;
  promptTokens = 0;
  promptTokensCached = 0;
  completionTokens = 0;
  reasoningTokens = 0;
  successfulRequests = 0;
  totalCost = 0.0;

  override handleLLMStart(_serialized: Serialized, _prompts: string[]): void {
    // Print out the prompts if needed
  }

  override handleLLMNewToken(_token: string): void {
    // Print out the token if needed
  }

  override handleLLMEnd(response: LLMResult): void {
    try {
      const generation = response.generations[0][0];

      let usageMetadata: UsageMetadata | undefined;
      let responseMetadata: ResponseMetadata | undefined;

      if (this.isChatGeneration(generation)) {
        const message = generation.message;
        usageMetadata = message.usage_metadata;
        responseMetadata = message.response_metadata;
      }

      let promptTokensCached = 0;
      let reasoningTokens = 0;

      if (usageMetadata) {
        const tokenUsage = usageMetadata.total_tokens;
        const completionTokens = usageMetadata.output_tokens;
        const promptTokens = usageMetadata.input_tokens;
        const modelName_ = (responseMetadata?.model_name ??
          response.llmOutput?.model_name) as string | undefined;
        const modelName = modelName_
          ? this.standardizeModelName(modelName_)
          : undefined;

        if (usageMetadata.input_token_details?.cache_read) {
          promptTokensCached = usageMetadata.input_token_details.cache_read;
        }

        if (usageMetadata.output_token_details?.reasoning) {
          reasoningTokens = usageMetadata.output_token_details.reasoning;
        }

        this.totalTokens += tokenUsage;
        this.promptTokens += promptTokens;
        this.promptTokensCached += promptTokensCached;
        this.completionTokens += completionTokens;
        this.reasoningTokens += reasoningTokens;
        this.successfulRequests++;

        const cost = modelName
          ? this.calculateCost({
              modelName,
              promptTokens,
              completionTokens,
              promptTokensCached,
            })
          : 0;
        this.totalCost += cost;
      } else if (response.llmOutput) {
        // Fallback to llmOutput if usageMetadata is not available
        const tokenUsage = response.llmOutput.token_usage as {
          completion_tokens?: number;
          prompt_tokens?: number;
        };

        const completionTokens = tokenUsage.completion_tokens ?? 0;
        const promptTokens = tokenUsage.prompt_tokens ?? 0;
        const modelName_ =
          (response.llmOutput.model_name as string | undefined) ?? "";
        const modelName = this.standardizeModelName(modelName_);

        this.totalTokens += completionTokens + promptTokens;
        this.promptTokens += promptTokens;
        this.completionTokens += completionTokens;
        this.successfulRequests++;

        const cost = this.calculateCost({
          modelName,
          promptTokens,
          completionTokens,
          promptTokensCached: 0,
        });
        this.totalCost += cost;
      } else {
        this.successfulRequests++;
      }
    } catch (error) {
      logger.error({ error }, "[OpenAICallbackHandler.config]");
    }
  }

  private isChatGeneration(
    generation: Generation,
  ): generation is ChatGeneration {
    return "message" in generation && generation.message instanceof AIMessage;
  }

  private standardizeModelName(modelName: string): ModelKeyEnum {
    return modelName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^gpt-/, "")
      .replace(/-\d{4}-\d{2}-\d{2}$/, "") as ModelKeyEnum;
  }

  private calculateCost({
    modelName,
    promptTokens,
    completionTokens,
    promptTokensCached,
  }: {
    modelName: ModelKeyEnum;
    promptTokens: number;
    completionTokens: number;
    promptTokensCached: number;
  }): number {
    const promptTokens_ = promptTokensCached
      ? promptTokens - promptTokensCached
      : promptTokensCached;
    const promptCostPer1K =
      modelName in openAIPricing1M
        ? openAIPricing1M[modelName].prompt / 1000
        : 0.0011; // $0.0011 per 1K tokens
    const completionCostPer1K =
      modelName in openAIPricing1M
        ? openAIPricing1M[modelName].completion / 1000
        : 0.0044; // $0.0044 per 1K tokens

    const cachedPromptCostPer1K =
      modelName in openAIPricing1M
        ? openAIPricing1M[modelName].cachedPrompt / 1000
        : 0;

    return (
      (promptTokens_ / 1000) * promptCostPer1K +
      (promptTokensCached / 1000) * cachedPromptCostPer1K +
      (completionTokens / 1000) * completionCostPer1K
    );
  }

  override toString(): string {
    return dedent`Tokens Used: ${this.totalTokens}
      Prompt Tokens: ${this.promptTokens}
      Prompt Tokens Cached: ${this.promptTokensCached}
      Completion Tokens: ${this.completionTokens}
      Reasoning Tokens: ${this.reasoningTokens}
      Successful Requests: ${this.successfulRequests}
      Total Cost (USD): $${this.totalCost.toFixed(2)}`;
  }
}

export function wrapLLMError(error: APIError) {
  if (error.status === 400) {
    if (
      error.type === "invalid_request_error" &&
      error.code === "context_length_exceeded"
    ) {
      return new PromptTooLongError({
        message: error.message,
      });
    }
    if (
      error.type === "invalid_request_error" &&
      error.code === "invalid_prompt"
    ) {
      return new InvalidPromptError({
        message: error.message,
        details: {
          cause: error.cause as object,
        },
      });
    }
  }
  if (error.constructor.name === APIConnectionTimeoutError.name) {
    return new ResponseTimeoutError({
      message: error.message,
    });
  }

  if (error instanceof UpstashRatelimitError) {
    return new RateLimitExceededError({
      message: error.message,
    });
  }

  if (error.status === 429) {
    const retryMatch = /in (?<seconds>[\d\\.]+)s/i.exec(error.message);
    const retryInSeconds = retryMatch
      ? parseFloat(retryMatch.groups?.seconds ?? "0")
      : undefined;

    return new RateLimitExceededError({
      message: error.message,
      details: {
        retryInSeconds: retryInSeconds ? retryInSeconds + 1 : 0,
      },
    });
  }

  if (error.name === "InsufficientQuotaError") {
    return new QuotaExceededError({
      message: error.message,
    });
  }

  return new InternalLLMError({
    message: error.message,
    details: {
      cause: error.cause as object,
    },
  });
}
