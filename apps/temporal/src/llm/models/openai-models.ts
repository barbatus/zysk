import { ChatOpenAI } from "@langchain/openai";
import {
  getConfig,
  ModelOwnerEnum,
  ModelProviderEnum,
  type OpenAIModelConfig,
  type OpenAIModelKey,
} from "@zysk/services";

import { ModelContainer, ModelIdentity } from "../core/base";
import { getAzureLLMContainers } from "./azure-openai-models";
import { LLMRunner } from "./runners";

function getOpenaiContainer(apiKey: string, config: OpenAIModelConfig) {
  return new ModelContainer(
    new LLMRunner(
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
      ModelProviderEnum.OpenAI,
      ModelOwnerEnum.OpenAI,
    ),
  );
}

export function getOpenAIModelContainers(
  modelKey: OpenAIModelKey,
  provider: ModelProviderEnum,
) {
  const appConfig = getConfig();
  if (!appConfig.openAI) {
    throw new Error("OpenAI config not found");
  }

  const modelConfig = appConfig.openAI.modelConfigs.find(
    (config) => config.modelName === modelKey,
  );
  if (!modelConfig) {
    throw new Error(`Model config not found: ${modelKey}`);
  }
  if (provider === ModelProviderEnum.Azure) {
    return getAzureLLMContainers(modelKey);
  }
  return [getOpenaiContainer(appConfig.openAI.apiKey, modelConfig)];
}
