import { createNextHandler } from "@ts-rest/serverless/next";
import { getAllScripts } from "@zysk/scripts";
import { adminContract } from "@zysk/ts-rest";

const handler = createNextHandler(
  adminContract,
  {
    getAdminScripts: async () => {
      return {
        status: 200,
        body: getAllScripts(),
      };
    },
    executeAdminScript: async () => {
      return {
        status: 200,
        body: {
          result: "OK",
        },
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
