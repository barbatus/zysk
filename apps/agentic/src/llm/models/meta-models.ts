import { ChatOpenAI } from "@langchain/openai";
import {
  getConfig,
  type MetaModelKey,
  ModelOwnerEnum,
  ModelProviderEnum,
} from "@zysk/services";

import { ModelContainer, ModelIdentity } from "../core/base";
import { LLMRunner } from "./runners";

function getNebiusContainer(
  apiKey: string,
  config: {
    modelName: string;
    providerModelName?: string;
  },
) {
  return new ModelContainer(
    new LLMRunner(
      new ChatOpenAI({
        apiKey,
        model: config.providerModelName ?? config.modelName,
        temperature: 0,
        maxRetries: 0,
        configuration: {
          baseURL: "https://api.studio.nebius.ai/v1/",
        },
      }),
    ),
    new ModelIdentity(
      config.modelName,
      config.providerModelName ?? config.modelName,
      ModelProviderEnum.Nebius,
      ModelOwnerEnum.Meta,
    ),
  );
}

export function getMetaContainers(
  modelKey: MetaModelKey,
  _provider: ModelProviderEnum,
) {
  const appConfig = getConfig();
  if (!appConfig.nebius) {
    throw new Error("Nebius config not found");
  }

  const modelConfig = appConfig.nebius.modelConfigs.find(
    (config) => config.modelName === String(modelKey),
  );
  if (!modelConfig) {
    throw new Error(`Model config not found: ${modelKey}`);
  }

  return [getNebiusContainer(appConfig.nebius.apiKey, modelConfig)];
}
