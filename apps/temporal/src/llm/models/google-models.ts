import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  getConfig,
  type GoogleModelKey,
  ModelOwnerEnum,
  ModelProviderEnum,
} from "@zysk/services";

import { ModelContainer, ModelIdentity } from "../core/base";
import { LLMRunner } from "./runners";

function getGoogleContainer(
  apiKey: string,
  config: {
    modelName: string;
    providerModelName?: string;
  },
) {
  return new ModelContainer(
    new LLMRunner(
      new ChatGoogleGenerativeAI({
        apiKey,
        model: config.providerModelName ?? config.modelName,
        temperature: 0,
        maxRetries: 0,
      }),
    ),
    new ModelIdentity(
      config.modelName,
      config.providerModelName ?? config.modelName,
      ModelProviderEnum.Google,
      ModelOwnerEnum.Google,
    ),
  );
}

export function getGoogleContainers(
  modelKey: GoogleModelKey,
  _provider: ModelProviderEnum,
) {
  const appConfig = getConfig();
  if (!appConfig.google) {
    throw new Error("Google config not found");
  }

  const modelConfig = appConfig.google.modelConfigs.find(
    (config) => config.modelName === String(modelKey),
  );
  if (!modelConfig) {
    throw new Error(`Model config not found: ${modelKey}`);
  }

  return [getGoogleContainer(appConfig.google.apiKey, modelConfig)];
}
