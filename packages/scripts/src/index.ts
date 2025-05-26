import { parseProgramArgsAndRun } from "./commander";
import { syncTickerOverviews, syncTickerQuotes, syncTickers } from "./tickers";

export const allScripts = [syncTickers, syncTickerQuotes, syncTickerOverviews];

async function runScripts() {
  let error: Error | undefined;
  console.log("Running scripts...");
  try {
    await parseProgramArgsAndRun(allScripts);
  } catch (e) {
    error = e as Error;
    console.error(error);
  }

  process.exit(error ? 1 : 0);
}

void runScripts();
