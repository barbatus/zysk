import { createNextHandler } from "@ts-rest/serverless/next";
import { getAllScripts, getScript } from "@zysk/scripts";
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
    executeAdminScript: async ({ body }) => {
      const script = getScript(body.name);

      try {
        return {
          status: 200,
          body: {
            result: await script.handler(
              ...body.arguments.map((arg) => arg.value),
              body.options,
            ),
          },
        };
      } catch (error) {
        return {
          status: 500,
          body: { error: (error as Error).message },
        };
      }
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
