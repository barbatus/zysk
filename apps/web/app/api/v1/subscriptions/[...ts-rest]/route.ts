import { createNextHandler } from "@ts-rest/serverless/next";
import { resolve, SubscriptionsService } from "@zysk/services";
import { subscriptionsContract } from "@zysk/ts-rest";

const handler = createNextHandler(
  subscriptionsContract,
  {
    getSubscriptions: async () => {
      const service = resolve(SubscriptionsService);
      return {
        status: 200,
        body: await service.getSubscriptions(
          "b655f123-9f69-4d6f-83d9-270e4673befb",
        ),
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
