import axios, { type AxiosResponse } from "axios";
import { subYears } from "date-fns";
import { inject, injectable } from "inversify";
import { isEmpty } from "lodash";

import { type AppConfig, appConfigSymbol } from "#/config";
import { RateLimitExceededError } from "#/utils/exceptions";

function processResponse<
  T extends
    | {
        "Error Message"?: string;
        Note?: string;
        Information?: string;
      }
    | undefined,
>(response: AxiosResponse<T>) {
  if (!response.data) {
    throw new Error("No data returned from Alpha Vantage");
  }

  if (isEmpty(response.data)) {
    return undefined;
  }

  if (response.data["Error Message"] ?? response.data.Note) {
    throw new Error(response.data["Error Message"] ?? response.data.Note);
  }

  if (response.data.Information?.includes("rate limits")) {
    throw new RateLimitExceededError(response.data.Information, 60);
  }

  return response.data;
}

@injectable()
export class AlphaVantageService {
  constructor(@inject(appConfigSymbol) private readonly appConfig: AppConfig) {}

  async getCompanyOverview(symbol: string) {
    const response = await axios.get<
      | {
          Description: string;
          Currency: string;
          Sector: string;
          AssetType: string;
          Country: string;
          Beta: string;
          "Error Message": string;
        }
      | undefined
    >("https://www.alphavantage.co/query", {
      params: {
        function: "OVERVIEW",
        symbol,
        apikey: this.appConfig.alphaVantageApiKey,
      },
    });

    const data = processResponse(response);

    return data
      ? {
          ...data,
          Beta: Number(data.Beta),
          symbol,
        }
      : undefined;
  }

  async getETFProfile(symbol: string) {
    const response = await axios.get<
      | {
          inception_date: string;
          sectors: {
            name: string;
            weight: number;
          }[];
          "Error Message": string;
        }
      | undefined
    >("https://www.alphavantage.co/query", {
      params: {
        function: "ETF_PROFILE",
        symbol,
        apikey: this.appConfig.alphaVantageApiKey,
      },
    });

    const data = processResponse(response);

    return data
      ? {
          ...data,
          symbol,
        }
      : undefined;
  }

  async getTimeSeriesDaily(
    symbol: string,
    outputsize: "full" | "compact" = "compact",
  ) {
    const response = await axios.get<
      | {
          "Time Series (Daily)": Record<string, Record<string, string>>;
          "Error Message"?: string;
          Note?: string;
        }
      | undefined
    >("https://www.alphavantage.co/query", {
      params: {
        function: "TIME_SERIES_DAILY",
        symbol,
        apikey: this.appConfig.alphaVantageApiKey,
        outputsize,
      },
    });

    const data = processResponse(response);
    if (!data) {
      return undefined;
    }

    const timeSeries = data["Time Series (Daily)"];

    const tenYearsAgo = subYears(new Date(), 10);
    const quotes = Object.entries(timeSeries)
      .filter(([dateStr]) => new Date(dateStr) >= tenYearsAgo)
      .map(([dateStr, values]) => {
        return {
          symbol,
          date: new Date(dateStr),
          openPrice: parseFloat(values["1. open"]),
          closePrice: parseFloat(values["4. close"]),
          high: parseFloat(values["2. high"]),
          low: parseFloat(values["3. low"]),
          volume: parseFloat(values["5. volume"]),
        };
      });

    return {
      ...data,
      symbol,
      quotes,
    };
  }
}
