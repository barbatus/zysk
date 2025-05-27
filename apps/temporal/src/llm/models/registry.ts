import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getConfig } from "@zysk/services";

import {
  SequentialModelContainer,
  SequentialModelContainerWithFallback,
} from "../core/base";
import { ModelKeyEnum, ModelProviderEnum } from "../core/enums";
import { getAzureLLMContainers } from "./azure-openai-model";
import { getOpenAIModelContainers } from "./openai-model";

export class ModelNotFoundError extends Error {
  constructor(modelKey: ModelKeyEnum) {
    super(`Model not found: ${modelKey}`);
    this.name = "ModelNotFoundError";
  }
}

const modelToMaxTokens = {
  [ModelKeyEnum.Gpt4o]: 128_000,
  [ModelKeyEnum.Gpt4oMini]: 128_000,
  [ModelKeyEnum.GptO1Mini]: 128_000,
  [ModelKeyEnum.GptO1]: 200_000,
  [ModelKeyEnum.GptO3Mini]: 200_000,
};

type OpenAIModelKey =
  | ModelKeyEnum.Gpt4o
  | ModelKeyEnum.Gpt4oMini
  | ModelKeyEnum.GptO1Mini
  | ModelKeyEnum.GptO1
  | ModelKeyEnum.GptO3Mini;

function createSequentialModelContainer(
  modelKey: OpenAIModelKey,
  provider = ModelProviderEnum.OpenAI,
) {
  const appConfig = getConfig();
  const ratelimit = appConfig.upstash
    ? new Ratelimit({
        redis: new Redis({
          url: appConfig.upstash.redisRestUrl,
          token: appConfig.upstash.redisRestToken,
        }),
        limiter: Ratelimit.fixedWindow(200_000, "60 s"),
      })
    : undefined;
  return new SequentialModelContainer(
    modelKey,
    provider === ModelProviderEnum.Azure
      ? getAzureLLMContainers(modelKey)
      : getOpenAIModelContainers(modelKey),
    modelToMaxTokens[modelKey],
    provider === ModelProviderEnum.OpenAI ? ratelimit : undefined,
  );
}

const models = new Proxy(
  {} as Record<OpenAIModelKey, SequentialModelContainer | undefined>,
  {
    get: (target, prop: string) => {
      const modelKey = prop as OpenAIModelKey;
      const model =
        target[modelKey] ?? createSequentialModelContainer(modelKey);
      target[modelKey] = model;
      return model;
    },
    has: (target, prop: string) => {
      return target[prop as OpenAIModelKey] !== undefined;
    },
  },
);

export function createSequentialModelContainerWithFallback(
  modelKey: ModelKeyEnum,
) {
  switch (modelKey) {
    case ModelKeyEnum.Gpt4o:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.Gpt4o]!,
        models[ModelKeyEnum.GptO1]!,
      ]);
    case ModelKeyEnum.Gpt4oMini:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.Gpt4oMini]!,
        models[ModelKeyEnum.GptO1Mini]!,
      ]);
    case ModelKeyEnum.GptO1Mini:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.GptO1Mini]!,
        models[ModelKeyEnum.GptO3Mini]!,
      ]);
    case ModelKeyEnum.GptO1:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.GptO1]!,
        models[ModelKeyEnum.Gpt4o]!,
      ]);
    case ModelKeyEnum.GptO3Mini:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.GptO3Mini]!,
        models[ModelKeyEnum.GptO1Mini]!,
      ]);
    default:
      throw new ModelNotFoundError(modelKey);
  }
}

export const modelsWithFallback = new Proxy(
  {} as Record<ModelKeyEnum, SequentialModelContainerWithFallback | undefined>,
  {
    get: (target, prop: string) => {
      const modelKey = prop as ModelKeyEnum;
      const model =
        target[modelKey] ??
        createSequentialModelContainerWithFallback(modelKey);
      target[modelKey] = model;
      return model;
    },
  },
);
