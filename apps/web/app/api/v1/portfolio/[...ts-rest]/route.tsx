import { createNextHandler } from "@ts-rest/serverless/next";
import { PortfolioService, resolve } from "@zysk/services";
import { portfolioContract } from "@zysk/ts-rest";

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
