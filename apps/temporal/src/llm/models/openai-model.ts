import { AIMessage } from "@langchain/core/messages";
import { type RunnableConfig } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { getConfig, type OpenAIModelConfig } from "@zysk/services";

import { BaseLLMRunner, ModelContainer, ModelIdentity } from "../core/base";
import {
  ModelKeyEnum,
  ModelProviderEnum,
  ModelVendorEnum,
} from "../core/enums";
import { type ExecutionResult } from "../core/schemas";
import { OpenAICallbackHandler } from "./callbacks";

export class OpenAIRunner extends BaseLLMRunner {
  async arun(
    message: string,
    config?: RunnableConfig,
  ): Promise<ExecutionResult> {
    const callback = new OpenAICallbackHandler();
    const start = performance.now();
    const result = await super.ainvoke(message, {
      ...config,
      callbacks: [callback],
    });
    const end = performance.now();
    return {
      response:
        result instanceof AIMessage ? (result.content as string) : result,
      evaluationDetails: {
        promptTokens: callback.promptTokens,
        completionTokens: callback.completionTokens,
        successfulRequests: callback.successfulRequests,
        totalCost: callback.totalCost,
        responseTimeMs: Math.round(end - start),
      },
    };
  }
}

function getOpenaiContainer(apiKey: string, config: OpenAIModelConfig) {
  return new ModelContainer(
    new OpenAIRunner(
      new ChatOpenAI({
        openAIApiKey: apiKey,
        model: config.modelName,
        temperature: config.temperature,
        maxRetries: 0,
        reasoningEffort: config.reasoningEffort,
      }),
    ),
    new ModelIdentity(
      config.modelName,
      config.modelName,
      ModelVendorEnum.OpenAI,
      ModelProviderEnum.OpenAI,
    ),
  );
}

export function getOpenAIModelContainers(modelKey: ModelKeyEnum) {
  const appConfig = getConfig();
  const modelConfig = appConfig.openAI.modelConfigs.find(
    (config) => config.modelName === String(modelKey),
  );
  if (!modelConfig) {
    throw new Error(`Model config not found: ${modelKey}`);
  }
  modelConfig.reasoningEffort =
    modelConfig.modelName === String(ModelKeyEnum.GptO3Mini)
      ? "high"
      : undefined;
  return [getOpenaiContainer(appConfig.openAI.apiKey, modelConfig)];
}
