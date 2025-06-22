import { orderBy } from "lodash";

import {
  scrapeUrl,
  syncNewsSources,
  syncSectors,
  syncSupportedTickers,
  syncTickerOverviews,
  syncTickerQuotes,
  syncTickers,
  syncTickerTimeSeries,
} from "./tickers";
import { type ScriptConfig } from "./utils";

export const allScripts = [
  syncTickers,
  syncTickerQuotes,
  syncTickerOverviews,
  syncTickerTimeSeries,
  syncSupportedTickers,
  syncSectors,
  scrapeUrl,
  syncNewsSources,
] as ScriptConfig[];

export function getAllScripts() {
  return orderBy(
    allScripts.map((script) => ({
      name: script.name,
      description: script.description,
      arguments: script.arguments.map((a) => ({
        name: a.name(),
        description: a.description,
        required: a.required,
        defaultValue: a.defaultValue as string | undefined,
      })),
      options: script.options.map((x) => ({
        name: x.name(),
        description: x.description,
      })),
      config: script,
    })),
    (x) => x.name,
    "desc",
  );
}

export function getScript(name: string) {
  const script = allScripts.find((x) => x.name === name);
  if (!script) {
    throw new Error(`Script ${name} not found`);
  }

  return script;
}
