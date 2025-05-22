import axios from "axios";
import { format } from "date-fns";
import { inject, injectable } from "inversify";

import { type AppConfig, appConfigSymbol } from "./config";

const finnhubApiUrl = "https://finnhub.io/api/v1";

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
    >(`${finnhubApiUrl}/stock/symbol`, {
      params: {
        exchange: "US",
        token: this.appConfig.finnhubApiKey,
      },
    });
    return response.data.filter((d) => symbols.includes(d.symbol));
  }

  async getTickerNews(params: {
    symbol: string;
    sinceDate: Date;
  }): Promise<{ url: string; title: string; newsDate: Date }[]> {
    const { symbol, sinceDate } = params;
    const from = format(sinceDate, "yyyy-MM-dd");
    const to = format(new Date(), "yyyy-MM-dd");
    const response = await axios.get<
      {
        id: number;
        datetime: number;
        headline: string;
        source: string;
        url: string;
      }[]
    >(
      `${finnhubApiUrl}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${this.appConfig.finnhubApiKey}`,
    );
    return response.data.map((d) => ({
      url: d.url,
      title: d.headline,
      newsDate: new Date(d.datetime * 1000),
    }));
  }
}
