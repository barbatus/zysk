import axios from "axios";
import { inject, injectable } from "inversify";

import { type AppConfig, appConfigSymbol } from "./config";

@injectable()
export class FinnhubService {
  constructor(@inject(appConfigSymbol) private readonly appConfig: AppConfig) {}

  async getUSSymbols(symbols: string[]) {
    const response = await axios.get<
      {
        symbol: string;
        type: "Common Stock" | "ETP";
        figi: string;
      }[]
    >("https://finnhub.io/api/v1/stock/symbol", {
      params: {
        exchange: "US",
        token: this.appConfig.finnhubApiKey,
      },
    });
    return response.data.filter((d) => symbols.includes(d.symbol));
  }
}
