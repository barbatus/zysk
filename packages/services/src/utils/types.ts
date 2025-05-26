import { type ExperimentTaskStatus } from "@zysk/db";

export interface AgentStateService<T> {
  create: () => Promise<T>;

  get: (id: string) => Promise<T>;

  setStatus: (
    id: string,
    status: ExperimentTaskStatus,
    response?: {
      text?: string;
      json?: object;
    },
  ) => Promise<void>;
}

export type Exact<T, Shape> = T extends Shape
  ? Exclude<keyof T, keyof Shape> extends never
    ? T
    : never
  : never;
