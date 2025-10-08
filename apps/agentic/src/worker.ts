import "reflect-metadata";

import path from "node:path";

import { NativeConnection, Worker } from "@temporalio/worker";
import { getAgenticConfigStatic } from "@zysk/services";
import type { Configuration as WebpackConfiguration } from "webpack";

import * as activities from "./activities";

async function run() {
  const config = getAgenticConfigStatic();

  const connectionOptions: Parameters<typeof NativeConnection.connect>[0] = {
    address: config.temporal.address,
  };

  if (config.temporal.tls) {
    connectionOptions.tls = true;
  }

  if (config.temporal.apiKey) {
    connectionOptions.apiKey = config.temporal.apiKey;
  }

  const connection = await NativeConnection.connect(connectionOptions);

  const bundlerOptions = {
    webpackConfigHook: (webpackConfig: WebpackConfiguration) => {
      const existingResolve = webpackConfig.resolve ?? {};
      const existingAlias = existingResolve.alias ?? {};
      return {
        ...webpackConfig,
        resolve: {
          ...existingResolve,
          alias: {
            ...existingAlias,
            "#": path.resolve(__dirname),
          },
        },
      };
    },
  };

  const worker = await Worker.create({
    connection,
    namespace: config.temporal.namespace,
    taskQueue: config.temporal.taskQueue,
    workflowsPath: require.resolve("./workflows/index"),
    activities,
    bundlerOptions,
  });

  await worker.run();
}

run().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
    if (error.stack) console.error(error.stack);
  } else {
    console.error(error);
  }
  process.exit(1);
});
