export const METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH =
  "user_portfolio_gain_loss_last_month";

export const METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY =
  "user_portfolio_gain_loss_today";

export const METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS =
  "user_portfolio_gain_loss_last_3_months";

export const METRIC_NAME_USER_PORTFOLIO_SEGMENTS = "user_portfolio_segments";

export const DIMENSION_NAME_TICKER = "symbol";
export const DIMENSION_NAME_PERIOD = "period";

export const ALL_DIMENSIONS = [DIMENSION_NAME_TICKER] as const;

export const ALL_METRICS = [
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_MONTH,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_TODAY,
  METRIC_NAME_USER_PORTFOLIO_GAIN_LOSS_LAST_3_MONTHS,
  METRIC_NAME_USER_PORTFOLIO_SEGMENTS,
] as const;
