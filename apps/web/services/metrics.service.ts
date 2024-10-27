import cube, { type BinaryFilter } from "@cubejs-client/core";
import { parseName, resolveViews } from "@zysk/cube";
import {
  type MetricsRequest,
  type MetricsResponse,
  type MetricValue,
} from "@zysk/ts-rest";
import { sign, verify } from "jsonwebtoken";
import { groupBy, intersection, merge } from "lodash";

let cubeToken = "";
const getToken = () => {
  try {
    verify(cubeToken, process.env.CUBE_API_SECRET!);
  } catch (e) {
    cubeToken = sign({}, process.env.CUBE_API_SECRET!, {
      expiresIn: "1d",
    });
  }
  return cubeToken;
};

export class MetricsService {
  async evalQuery({
    metrics,
    filters = [],
    groupBys,
    timezone,
  }: MetricsRequest): Promise<MetricsResponse> {
    const cubeApi = cube(getToken(), {
      apiUrl: process.env.CUBE_API_URL!,
    });

    const metricViews = resolveViews(metrics);

    const results = await Promise.all(
      metricViews.flatMap((v) => {
        const groupingSets = groupBys.map((group) => {
          return group.map((d) => {
            const resolved = v.resolveDimension(d);
            if (!resolved) {
              throw new Error(`Dimension ${d} not found in ${v.name} view`);
            }
            return resolved;
          });
        });
        const viewMetrics = intersection(
          v.metrics.map((m) => m.name),
          metrics,
        );
        const metricsWPeriods = viewMetrics
          .filter((m) => v.resolveMetricPeriod(m))
          .filter(Boolean);
        const otherMetrics = viewMetrics
          .filter((m) => !v.resolveMetricPeriod(m))
          .filter(Boolean);

        const cubeFilters = filters.map((f) => {
          const dimension = v.resolveDimension(f.dimensionName)!;
          if (!dimension) {
            throw new Error(
              `Dimension ${f.dimensionName} not found in ${v.name} view`,
            );
          }
          return {
            operator: f.operation,
            member: dimension,
            values: f.values,
          } as BinaryFilter;
        });

        return groupingSets.flatMap((gset) => {
          const promises = otherMetrics.length
            ? [
                cubeApi.load({
                  dimensions: gset,
                  measures: otherMetrics.map((m) => v.resolveMetric(m)!),
                  filters: [
                    {
                      or: cubeFilters,
                    },
                  ],
                  timezone,
                }),
              ]
            : [];

          return promises.concat(
            metricsWPeriods.flatMap((m) => {
              return cubeApi.load({
                dimensions: gset,
                measures: [v.resolveMetric(m)!],
                filters: [{ or: cubeFilters }],
                timeDimensions: [v.resolveMetricPeriod(m)!],
                timezone,
              });
            }),
          );
        });
      }),
    );

    const groupResults = groupBy(results, (r) =>
      r.query().dimensions!.join(","),
    );

    const finalResults = Object.keys(groupResults).map((key) => {
      const group = key.split(",").filter(Boolean);

      const rows = groupBy(
        groupResults[key].flatMap((r) => r.rawData()),
        (r) => group.map((d) => r[d]).join(","),
      );

      const resultRows = Object.values(rows).map((row) => {
        return merge({}, ...row) as Record<string, string | number | boolean>;
      });

      const allMeasures = groupResults[key].flatMap(
        (res) => res.query().measures!,
      );
      const columns = group.concat(allMeasures);

      return {
        columns: columns.map((c) => parseName(c)),
        rows: resultRows.map((row) =>
          columns.map((c) => row[c]),
        ) as MetricValue[][],
      };
    });

    return { results: finalResults };
  }
}
