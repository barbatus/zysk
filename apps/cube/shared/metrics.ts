import {
  DIMENSION_NAME_PERIOD,
  DIMENSION_NAME_TICKER,
  METRIC_NAME_USER_TICKER_GAIN_LOSS_LAST_MONTH,
} from "./constants";
import { type Metric } from "./types";

export const METRIC_USER_TICKER_GAIN_LOSS_LAST_MONTH = {
  name: METRIC_NAME_USER_TICKER_GAIN_LOSS_LAST_MONTH,
  title: "User Ticker Position Gain/Loss",
  period: "last month" as const,
};

export const UserTickerView = {
  name: "UserTickers",

  get metrics(): Metric[] {
    return [METRIC_USER_TICKER_GAIN_LOSS_LAST_MONTH];
  },

  get dimensions(): string[] {
    return [DIMENSION_NAME_TICKER];
  },

  resolveMetric(metricName: string) {
    const metric = this.metrics.find((m) => m.name === metricName);
    return metric ? `${this.name}.${metric.name}` : null;
  },

  resolveMetricPeriod(metricName: string) {
    const metric = this.metrics.find((m) => m.name === metricName);
    return metric?.period
      ? {
          dimension: `${this.name}.${DIMENSION_NAME_PERIOD}`,
          dateRange: metric.period,
        }
      : null;
  },

  resolveDimension(dimName: string) {
    const dimension = this.dimensions.find((d) => d === dimName);
    return dimension ? `${this.name}.${dimension}` : null;
  },
};
