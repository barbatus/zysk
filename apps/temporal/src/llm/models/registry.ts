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
import { getDeepSeekModelContainers } from "./deepseek-model";
import { ModelContainer } from "../core/base";

export class ModelNotFoundError extends Error {
  constructor(modelKey: ModelKeyEnum) {
    super(`Model not found: ${modelKey}`);
    this.name = "ModelNotFoundError";
  }
}

export const MODEL_TO_MAX_TOKENS = {
  [ModelKeyEnum.Gpt4o]: 128_000,
  [ModelKeyEnum.Gpt4oMini]: 128_000,
  [ModelKeyEnum.GptO1Mini]: 128_000,
  [ModelKeyEnum.GptO1]: 200_000,
  [ModelKeyEnum.GptO3Mini]: 200_000,
  [ModelKeyEnum.DeepSeekReasoner]: 65_000,
};

type OpenAIModelKey =
  | ModelKeyEnum.Gpt4o
  | ModelKeyEnum.Gpt4oMini
  | ModelKeyEnum.GptO1Mini
  | ModelKeyEnum.GptO1
  | ModelKeyEnum.GptO3Mini;

const openaiModelKeys = [
  ModelKeyEnum.Gpt4o,
  ModelKeyEnum.Gpt4oMini,
  ModelKeyEnum.GptO1Mini,
  ModelKeyEnum.GptO1,
  ModelKeyEnum.GptO3Mini,
];

type DeepSeekModelKey = ModelKeyEnum.DeepSeekReasoner;

function createSequentialModelContainer(
  modelKey: OpenAIModelKey | DeepSeekModelKey,
  openAIProvider = ModelProviderEnum.OpenAI,
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

  let containers: ModelContainer[] = [];
  if (openaiModelKeys.includes(modelKey)) {
    containers = openAIProvider === ModelProviderEnum.Azure
      ? getAzureLLMContainers(modelKey)
      : getOpenAIModelContainers(modelKey);
  }

  if (modelKey === ModelKeyEnum.DeepSeekReasoner) {
    containers = getDeepSeekModelContainers(modelKey);
  }

  return new SequentialModelContainer(
    modelKey,
    containers,
    MODEL_TO_MAX_TOKENS[modelKey],
    openAIProvider === ModelProviderEnum.OpenAI ? ratelimit : undefined,
  );
}

const models = new Proxy(
  {} as Record<OpenAIModelKey | DeepSeekModelKey, SequentialModelContainer | undefined>,
  {
    get: (target, prop: string) => {
      const modelKey = prop as OpenAIModelKey | DeepSeekModelKey;
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
    case ModelKeyEnum.DeepSeekReasoner:
      return new SequentialModelContainerWithFallback([
        models[ModelKeyEnum.DeepSeekReasoner]!,
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
