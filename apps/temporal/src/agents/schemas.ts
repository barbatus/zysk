import { type ModelProviderEnum, type ModelVendorEnum } from "./enums";

export interface EvaluationDetails {
  promptTokens: number;
  completionTokens: number;
  successfulRequests: number;
  totalCost: number; // USD
}

export interface ExecutionInfo {
  responseTimeMs: number;
}

export interface ExecutionResult {
  response: string;
  evaluationDetails: EvaluationDetails;
  executionInfo: ExecutionInfo;
}

export abstract class ModelIdentity {
  abstract id: string;
  abstract title: string;
  abstract vendor: ModelVendorEnum;
  abstract provider: ModelProviderEnum;

  toString(): string {
    return `ModelIdentity(id=${this.id}, title=${this.title}, vendor=${this.vendor}, provider=${this.provider})`;
  }
}
