import { ChatOpenAI } from "@langchain/openai";
import { getConfig, type OpenAIModelConfig } from "@zysk/services";

import { ModelContainer, ModelIdentity } from "../core/base";
import {
  type ModelKeyEnum,
  ModelProviderEnum,
  ModelVendorEnum,
} from "../core/enums";
import { OpenAIRunner } from "./azure-openai-model";

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
  if (!appConfig.openAI) {
    throw new Error("OpenAI config not found");
  }

  const modelConfig = appConfig.openAI.modelConfigs.find(
    (config) => config.modelName === String(modelKey),
  );
  if (!modelConfig) {
    throw new Error(`Model config not found: ${modelKey}`);
  }
  return [getOpenaiContainer(appConfig.openAI.apiKey, modelConfig)];
}
