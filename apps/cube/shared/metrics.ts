import {
  DIMENSION_NAME_PERIOD,
  DIMENSION_NAME_POSITION_ID,
  DIMENSION_NAME_QUOTE,
  DIMENSION_NAME_TICKER,
  METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE,
  METRIC_NAME_TICKER_PREV_DAY_PERFORMANCE,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY,
  METRIC_NAME_USER_PORTFOLIO_SEGMENTS,
} from "./constants";
import { type Metric } from "./types";

export const METRIC_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH = {
  name: METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH,
  title: "Last month's gain/loss",
  period: "last month" as const,
};

export const METRIC_USER_PORTFOLIO_GAIN_LOSS_TODAY = {
  name: METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY,
  title: "Today's gain/loss",
  period: "today" as const,
};

export const METRIC_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS = {
  name: METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS,
  title: "Last 3 months' gain/loss",
  period: "last 3 months" as const,
};

export const METRIC_USER_PORTFOLIO_SEGMENTS = {
  name: METRIC_NAME_USER_PORTFOLIO_SEGMENTS,
  title: "Portfolio segments",
};

export const METRIC_TICKER_LAST_WEEK_PERFORMANCE = {
  name: METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE,
  title: "Last week's performance",
};

export const METRIC_TICKER_PREV_DAY_PERFORMANCE = {
  name: METRIC_NAME_TICKER_PREV_DAY_PERFORMANCE,
  title: "Previous day's performance",
};

class BasePortfolioView {
  name = "";

  get metrics(): Metric[] {
    return [];
  }

  get dimensions(): string[] {
    return [DIMENSION_NAME_TICKER];
  }

  resolveMetric(metricName: string) {
    const metric = this.metrics.find((m) => m.name === metricName);
    return metric ? `${this.name}.${metric.name}` : null;
  }

  resolveMetricPeriod(metricName: string) {
    const metric = this.metrics.find((m) => m.name === metricName);
    return metric?.period
      ? {
          dimension: `${this.name}.${DIMENSION_NAME_PERIOD}`,
          dateRange: metric.period,
        }
      : null;
  }

  resolveDimension(dimName: string) {
    const dimension = this.dimensions.find((d) => d === dimName);
    return dimension ? `${this.name}.${dimension}` : null;
  }
}

class UserPortfolioView extends BasePortfolioView {
  name = "Portfolio";

  get dimensions(): string[] {
    return [DIMENSION_NAME_POSITION_ID, DIMENSION_NAME_TICKER];
  }

  get metrics(): Metric[] {
    return [
      METRIC_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH,
      METRIC_USER_PORTFOLIO_GAIN_LOSS_TODAY,
      METRIC_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS,
    ];
  }
}
class UserPortfolioSegmentsView extends BasePortfolioView {
  name = "PortfolioSegments";

  get dimensions(): string[] {
    return [];
  }

  get metrics(): Metric[] {
    return [METRIC_USER_PORTFOLIO_SEGMENTS];
  }
}

class TickerMetricsView extends BasePortfolioView {
  name = "TickerMetrics";

  get dimensions(): string[] {
    return [DIMENSION_NAME_TICKER, DIMENSION_NAME_QUOTE];
  }

  get metrics(): Metric[] {
    return [
      METRIC_TICKER_LAST_WEEK_PERFORMANCE,
      METRIC_TICKER_PREV_DAY_PERFORMANCE,
    ];
  }
}

export const ALL_VIEWS = [
  new UserPortfolioView(),
  new UserPortfolioSegmentsView(),
  new TickerMetricsView(),
];
