import { ChatDeepSeek } from "@langchain/deepseek";
import {
  getConfig,
  type ModelKeyEnum,
  ModelOwnerEnum,
  ModelProviderEnum,
} from "@zysk/services";

import { ModelContainer, ModelIdentity } from "../core/base";
import { LLMRunner } from "./runners";

function getDeepSeekContainer(
  apiKey: string,
  config: { modelName: string; temperature: number },
) {
  return new ModelContainer(
    new LLMRunner(
      new ChatDeepSeek({
        apiKey,
        model: config.modelName,
        temperature: config.temperature,
        maxRetries: 0,
      }),
    ),
    new ModelIdentity(
      config.modelName,
      config.modelName,
      ModelProviderEnum.DeepSeek,
      ModelOwnerEnum.DeepSeek,
    ),
  );
}

function getNebiusContainer(
  apiKey: string,
  config: {
    modelName: string;
    temperature: number;
    providerModelName?: string;
  },
) {
  return new ModelContainer(
    new LLMRunner(
      new ChatDeepSeek({
        apiKey,
        model: config.providerModelName ?? config.modelName,
        temperature: config.temperature,
        maxRetries: 0,
        configuration: {
          baseURL: "https://api.studio.nebius.ai/v1/",
        },
      }),
    ),
    new ModelIdentity(
      config.providerModelName ?? config.modelName,
      config.modelName,
      ModelProviderEnum.Nebius,
      ModelOwnerEnum.DeepSeek,
    ),
  );
}

function getModelConfig(modelKey: ModelKeyEnum, provider?: ModelProviderEnum) {
  const appConfig = getConfig();
  const modelConfigs =
    provider === ModelProviderEnum.Nebius
      ? appConfig.nebius
      : appConfig.deepSeek;

  if (!modelConfigs) {
    throw new Error("Provider config not found");
  }

  const modelConfig = modelConfigs.modelConfigs.find(
    (config) => config.modelName === String(modelKey),
  );

  if (!modelConfig) {
    throw new Error(`Model config not found: ${modelKey}`);
  }

  return [modelConfigs.apiKey, modelConfig] as const;
}

export function getDeepSeekModelContainers(
  modelKey: ModelKeyEnum,
  provider?: ModelProviderEnum,
) {
  const [apiKey, modelConfig] = getModelConfig(modelKey, provider);

  if (provider === ModelProviderEnum.Nebius) {
    return [getNebiusContainer(apiKey, modelConfig)];
  }

  return [getDeepSeekContainer(apiKey, modelConfig)];
}
