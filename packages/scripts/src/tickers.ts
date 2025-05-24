import { getScript } from "./utils";

export const syncTickers = getScript({
  name: "sync-tickers",
  description: "Load all available tickers and save them to the database.",
})(async () => {
  return "OK";
});
