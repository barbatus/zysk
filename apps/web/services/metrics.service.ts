import cube, { type BinaryFilter } from "@cubejs-client/core";
import { parseName, resolveViews } from "@zysk/cube";
import {
  type MetricsRequest,
  type MetricsResponse,
  type MetricValue,
} from "@zysk/ts-rest";
import { sign, verify } from "jsonwebtoken";

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
        const metricsWPeriods = metrics
          .filter((m) => v.resolveMetricPeriod(m))
          .filter(Boolean);
        const otherMetrics = metrics
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

        return groupingSets.flatMap((set) => {
          const promises = otherMetrics.length
            ? [
                cubeApi.load({
                  dimensions: set,
                  measures: otherMetrics.map((m) => v.resolveMetric(m)!),
                  filters: [
                    {
                      or: cubeFilters,
                    },
                  ],
                }),
              ]
            : [];

          return promises.concat(
            metricsWPeriods.flatMap((m) => {
              return cubeApi.load({
                dimensions: set,
                measures: [v.resolveMetric(m)!],
                filters: [{ or: cubeFilters }],
                timeDimensions: [v.resolveMetricPeriod(m)!],
              });
            }),
          );
        });
      }),
    );

    return {
      results: results.map((res) => {
        const query = res.query();
        const columns = query.dimensions!.concat(query.measures!);
        return {
          columns: columns.map((c) => parseName(c)),
          rows: res.rawData().map((row) => {
            return columns.map((c) => row[c]);
          }) as MetricValue[][],
        };
      }),
    };
  }
}
