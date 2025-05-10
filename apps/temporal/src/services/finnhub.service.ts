import axios from "axios";

import { appConfig } from "../config";

export class FinnhubService {
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
        token: appConfig.finnhubApiKey,
      },
    });
    return response.data.filter((d) => symbols.includes(d.symbol));
  }
}

export const finnhubService = new FinnhubService();
