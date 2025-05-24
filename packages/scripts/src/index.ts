import { parseProgramArgsAndRun } from "./commander";
import { syncTickers } from "./tickers";

export const allScripts = [syncTickers];

async function runScripts() {
  let error: Error | undefined;
  try {
    await parseProgramArgsAndRun(allScripts);
  } catch (e) {
    error = e as Error;
    console.error(error);
  }

  process.exit(error ? 1 : 0);
}

void runScripts();
