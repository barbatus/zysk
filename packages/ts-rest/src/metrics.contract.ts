import { initContract } from "@ts-rest/core";
import { DimensionNameSchema, MetricNameSchema } from "@zysk/cube";
import { z } from "zod";

const c = initContract();

export const MetricFilterSchema = z.object({
  dimensionName: DimensionNameSchema,
  operation: z.enum(["equals"]),
  values: z.array(z.string()).nonempty(),
});

export type MetricFilter = z.infer<typeof MetricFilterSchema>;

const MetricsRequestSchema = z.object({
  metrics: z.array(MetricNameSchema).nonempty(),
  filters: z.array(MetricFilterSchema).optional(),
  groupBys: z.array(z.array(DimensionNameSchema)),
  timezone: z.string().optional(),
});

export type MetricsRequest = z.infer<typeof MetricsRequestSchema>;

const MetricValueSchema = z.number().or(z.string()).nullable();

const MetricObjectSchema = z.record(z.number()).nullable();

export type MetricValue = z.infer<typeof MetricValueSchema>;
export type MetricObject = z.infer<typeof MetricObjectSchema>;

const QueryResultSetSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(MetricValueSchema)),
});

const MetricsResponseSchema = z.object({
  results: z.array(QueryResultSetSchema),
});

export type MetricsResponse = z.infer<typeof MetricsResponseSchema>;

export const metricsContract = c.router(
  {
    evalQuery: {
      method: "GET",
      path: "query",
      query: MetricsRequestSchema,
      responses: {
        200: MetricsResponseSchema,
        400: z.object({
          error: z.string(),
        }),
      },
    },
  },
  {
    pathPrefix: "/api/v1/metrics/",
  },
);
