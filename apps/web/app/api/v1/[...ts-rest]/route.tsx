import { createNextHandler } from "@ts-rest/serverless/next";
import { metricsContract } from "@zysk/ts-rest";

import { resolve } from "#/services";
import { MetricsService } from "#/services/metrics.service";

const handler = createNextHandler(
  metricsContract,
  {
    evalQuery: async ({ query }) => {
      const service = resolve(MetricsService);
      return {
        status: 201,
        body: await service.evalQuery(query),
      };
    },
  },
  {
    handlerType: "app-router",
    jsonQuery: true,
  },
);

export {
  handler as DELETE,
  handler as GET,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
