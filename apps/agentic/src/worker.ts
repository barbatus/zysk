import path from "node:path";

import { NativeConnection, Worker } from "@temporalio/worker";
import { Command } from "commander";
import type { Configuration as WebpackConfiguration } from "webpack";

import * as activities from "./activities";
import * as crawlerActivities from "./workflows/crawler/activities";
import * as scrapperActivities from "./workflows/scrapper/activities";

interface RunOptions {
  runMain: boolean;
  runScrapper: boolean;
}

async function run(options: RunOptions) {
  const connection = await NativeConnection.connect({
    address: "localhost:7233",
  });

  const runs: Promise<void>[] = [];

  const bundlerOptions = {
    webpackConfigHook: (config: WebpackConfiguration) => {
      const existingResolve = config.resolve ?? {};
      const existingAlias = existingResolve.alias ?? {};
      return {
        ...config,
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

  if (options.runMain) {
    const workerMain = await Worker.create({
      connection,
      taskQueue: "zysk-data",
      workflowsPath: require.resolve("./workflows/index"),
      activities,
      bundlerOptions,
    });
    runs.push(workerMain.run());
  }

  if (options.runScrapper) {
    const workerScrapper = await Worker.create({
      connection,
      taskQueue: "zysk-scrapper",
      workflowsPath: require.resolve("./workflows/scrapper-workflows"),
      activities: {
        ...scrapperActivities,
        ...crawlerActivities,
      },
      // 30 activities per minute
      maxActivitiesPerSecond: 0.5,
      maxConcurrentActivityTaskExecutions: 20,
      bundlerOptions,
    });
    runs.push(workerScrapper.run());
  }

  if (runs.length === 0) {
    console.warn(
      "No workers selected to run. Use --main and/or --scrapper flags, " +
        "or run without flags to start both.",
    );
    return;
  }

  await Promise.all(runs);
}

const program = new Command();
program
  .name("agentic-worker")
  .description("Temporal workers for Zysk")
  .option("--main", "Run main worker (taskQueue: zysk-data)")
  .option("--scrapper", "Run scrapper worker (taskQueue: zysk-scrapper)");

program.parse(process.argv);
const opts = program.opts<{
  main?: boolean;
  scrapper?: boolean;
}>();

const runMain = Boolean(opts.main);
const runScrapper = Boolean(opts.scrapper);

run({ runMain, runScrapper }).catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
    if (error.stack) console.error(error.stack);
  } else {
    console.error(error);
  }
  process.exit(1);
});
