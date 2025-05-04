import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { type Generation, type LLMResult } from "@langchain/core/outputs";
import dedent from "dedent";

import { logger } from "#/utils/logger";

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

export class OpenAICallbackHandler extends BaseCallbackHandler {
  readonly name = "OpenAICallbackHandler";
  totalTokens = 0;
  promptTokens = 0;
  promptTokensCached = 0;
  completionTokens = 0;
  reasoningTokens = 0;
  successfulRequests = 0;
  totalCost = 0.0;

  onLLMStart(_serialized: Record<string, unknown>, _prompts: string[]): void {
    // Print out the prompts if needed
  }

  onLLMNewToken(_token: string): void {
    // Print out the token if needed
  }

  onLLMEnd(response: LLMResult): void {
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
          : "";

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

        const cost = this.calculateCost(
          modelName,
          promptTokens,
          completionTokens,
        );
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

        const cost = this.calculateCost(
          modelName,
          promptTokens,
          completionTokens,
        );
        this.totalCost += cost;
      } else {
        this.successfulRequests++;
      }
    } catch (error) {
      logger.error({ error }, "[OpenAICallbackHandler.onLLMEnd]");
    }
  }

  private isChatGeneration(
    generation: Generation,
  ): generation is ChatGeneration {
    return (
      "type" in generation && (generation as { type: string }).type === "chat"
    );
  }

  private standardizeModelName(modelName: string): string {
    return modelName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  }

  private calculateCost(
    modelName: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    // Add your cost calculation logic here based on model and token counts
    // This is a placeholder implementation
    const promptCostPer1K = 0.01; // $0.01 per 1K tokens
    const completionCostPer1K = 0.03; // $0.03 per 1K tokens

    return (
      (promptTokens / 1000) * promptCostPer1K +
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
