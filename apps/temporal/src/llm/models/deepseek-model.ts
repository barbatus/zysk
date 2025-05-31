import { AIMessage } from "@langchain/core/messages";
import { getConfig } from "@zysk/services";
import { type APIError } from "openai";
import { ChatDeepSeek } from "@langchain/deepseek";

import { BaseLLMRunner, ModelContainer, ModelIdentity } from "../core/base";
import {
  type ModelKeyEnum,
  ModelProviderEnum,
  ModelVendorEnum,
} from "../core/enums";
import { type ExecutionResult } from "../core/schemas";
import { wrapOpenAIError } from "./callbacks";

export class DeepSeekRunner extends BaseLLMRunner {
  async arun(message: string): Promise<ExecutionResult> {
    try {
      const start = performance.now();
      const result = await super.ainvoke(message, {
        callbacks: [],
      });
      const end = performance.now();
      return {
        response:
          result instanceof AIMessage ? (result.content as string) : result,
        evaluationDetails: {
          promptTokens: 0,
          completionTokens: 0,
          successfulRequests: 1,
          totalCost: 0,
          responseTimeMs: Math.round(end - start),
        },
      };
    } catch (error) {
      throw wrapOpenAIError(error as APIError);
    }
  }
}

function getDeepSeekContainer(
  apiKey: string,
  config: { modelName: string; temperature: number },
) {
  return new ModelContainer(
    new DeepSeekRunner(
      new ChatDeepSeek({
        apiKey,
        model: config.modelName,
        temperature: config.temperature,
      }),
    ),
    new ModelIdentity(
      config.modelName,
      config.modelName,
      ModelVendorEnum.DeepSeek,
      ModelProviderEnum.DeepSeek,
    ),
  );
}

export function getDeepSeekModelContainers(modelKey: ModelKeyEnum) {
  const appConfig = getConfig();
  if (!appConfig.deepSeek) {
    throw new Error("DeepSeek config not found");
  }

  const modelConfig = appConfig.deepSeek.modelConfigs.find(
    (config) => config.modelName === String(modelKey),
  );
  if (!modelConfig) {
    throw new Error(`Model config not found: ${modelKey}`);
  }
  return [getDeepSeekContainer(appConfig.deepSeek.apiKey, modelConfig)];
}
