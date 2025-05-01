import { ApplicationFailure } from "@temporalio/workflow";

export async function fetchUSSymbols(_symbols: string[]): Promise<string> {
  throw new ApplicationFailure("Test", "NonRetryable", false);
}
