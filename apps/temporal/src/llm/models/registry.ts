import {
  SequentialModelContainer,
  SequentialModelContainerWithFallback,
} from "../core/base";
import { ModelKeyEnum } from "../core/enums";
import { getAzureLLMContainers } from "./azure-model";

export class ModelNotFoundError extends Error {
  constructor(modelKey: ModelKeyEnum) {
    super(`Model not found: ${modelKey}`);
    this.name = "ModelNotFoundError";
  }
}

function createSequentialModelContainer(modelKey: ModelKeyEnum) {
  switch (modelKey) {
    case ModelKeyEnum.Gpt4o:
      return new SequentialModelContainer(
        modelKey,
        getAzureLLMContainers("4o_containers"),
        128_000,
      );
    case ModelKeyEnum.Gpt4oMini:
      return new SequentialModelContainer(
        modelKey,
        getAzureLLMContainers("4omini_containers"),
        128_000,
      );
    case ModelKeyEnum.GptO1Mini:
      return new SequentialModelContainer(
        modelKey,
        getAzureLLMContainers("o1_mini_containers"),
        128_000,
      );
    case ModelKeyEnum.GptO1:
      return new SequentialModelContainer(
        modelKey,
        getAzureLLMContainers("o1_containers"),
        200_000,
      );
    case ModelKeyEnum.GptO3Mini:
      return new SequentialModelContainer(
        modelKey,
        getAzureLLMContainers("o3_mini_containers"),
        200_000,
      );
    default:
      throw new ModelNotFoundError(modelKey);
  }
}

const models = new Proxy(
  {} as Record<ModelKeyEnum, SequentialModelContainer | undefined>,
  {
    get: (target, prop: string) => {
      const modelKey = prop as ModelKeyEnum;
      const model =
        target[modelKey] ?? createSequentialModelContainer(modelKey);
      target[modelKey] = model;
      return model;
    },
    has: (target, prop: string) => {
      return target[prop as ModelKeyEnum] !== undefined;
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
