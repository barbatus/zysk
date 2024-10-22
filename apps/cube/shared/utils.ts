import { UserTickerView } from "./metrics";

const views = [UserTickerView];

export function resolveViews(metricNames: [string, ...string[]]) {
  return metricNames.map((m) => {
    const metricViews = views.filter((v) => v.resolveMetric(m));
    if (!metricViews.length) {
      throw new Error(`${m} metric is not found`);
    }

    if (metricViews.length >= 2) {
      throw new Error(`${m} metric is not unique`);
    }
    return metricViews[0];
  });
}

export function resolveMetric(metricName: string) {
  const targetViews = views.filter(
    (v) => v.metrics.filter((m) => m.name === metricName).length,
  );

  if (targetViews.length === 0) {
    throw new Error(`Unknown metric: ${metricName}`);
  }

  if (targetViews.length >= 2) {
    throw new Error(`Metric ${metricName} name should be unique`);
  }

  return targetViews[0].resolveMetric(metricName);
}

export function parseName(fullDimensionOrMetricName: string) {
  const [_, name] = fullDimensionOrMetricName.split(".");
  return name;
}
