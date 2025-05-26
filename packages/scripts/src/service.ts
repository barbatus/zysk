import { orderBy } from "lodash";

import { syncTickers } from "./tickers";

export function getAllScripts() {
  const scripts = [syncTickers];

  return orderBy(
    scripts.map((script) => ({
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
