import type { Argument, Option } from "commander";
import { InvalidArgumentError } from "commander";

export const ArgumentParsers = {
  string: (val: string) => val,
  number: (val: string) => {
    const res = Number(val);
    if (Number.isNaN(res)) {
      throw new InvalidArgumentError("Not a valid number");
    }
    return res;
  },
};

interface ScriptOptions {
  name: string;
  description?: string;
  arguments?: Argument[];
  options?: Option[];
}

type ScriptHandler<TArgs extends unknown[] = unknown[]> = (
  ...args: TArgs
) => Promise<unknown>;

export interface ScriptConfig<TArgs extends unknown[] = unknown[]>
  extends ScriptOptions {
  arguments: Argument[];
  options: Option[];
  handler: ScriptHandler<TArgs>;
}

export const TASK_SYMBOL = Symbol.for("api:Script");

export function getScript<TArgs extends unknown[] = unknown[]>(
  options: ScriptOptions,
): (handler: ScriptHandler<TArgs>) => ScriptConfig<TArgs> {
  return (handler: ScriptHandler<TArgs>) => {
    return {
      ...options,
      arguments: options.arguments ?? [],
      options: options.options ?? [],
      handler,
      [TASK_SYMBOL]: true,
    };
  };
}

export function isScript(anything: Record<symbol, unknown>): boolean {
  return Boolean(anything[TASK_SYMBOL]);
}
