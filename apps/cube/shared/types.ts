import { z } from "zod";
import { ALL_DIMENSIONS, ALL_METRICS } from "./constants";

const MetricSchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string().optional(),
  period: z
    .enum(["last month", "last 3 months", "today", "yesterday"])
    .optional(),
});

export type Metric = z.infer<typeof MetricSchema>;

export const MetricNameSchema = z.enum(ALL_METRICS);
export const DimensionNameSchema = z.enum(ALL_DIMENSIONS);

export interface CubeFilter {
  member: string;
  operator: string;
  values: string[];
}
