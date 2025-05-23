import { type ExperimentTaskStatus } from "@zysk/db";

export interface StateService<T> {
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
