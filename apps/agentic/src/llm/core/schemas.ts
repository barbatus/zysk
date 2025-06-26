import { z } from "zod";

export const EvaluationDetailsSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  successfulRequests: z.number(),
  totalCost: z.number(), // USD
  responseTimeMs: z.number(),
});

export type EvaluationDetails = z.infer<typeof EvaluationDetailsSchema>;

export const ExecutionResultSchema = z.object({
  response: z.string(),
  evaluationDetails: EvaluationDetailsSchema,
});

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;

export interface AgentExecutionResult<AResult> {
  response: AResult;
  evaluationDetails: EvaluationDetails;
}
