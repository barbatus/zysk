import { createNextHandler } from "@ts-rest/serverless/next";
import { portfolioContract } from "@zysk/ts-rest";

import { resolve } from "#/services";
import { PortfolioService } from "#/services/portfolio.service";

const handler = createNextHandler(
  portfolioContract,
  {
    queryWithFilter: async () => {
      const service = resolve(PortfolioService);
      return {
        status: 200,
        body: await service.getPositions(),
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
