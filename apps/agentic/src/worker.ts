import { NativeConnection, Worker } from "@temporalio/worker";

import * as activities from "./activities";
import * as crawlerActivities from "./workflows/crawler/activities";
import * as scrapperActivities from "./workflows/scrapper/activities";

async function run() {
  const connection = await NativeConnection.connect({
    address: "localhost:7233",
  });
  const workerMain = await Worker.create({
    connection,
    taskQueue: "zysk-data",
    workflowsPath: require.resolve("./workflows/index"),
    activities,
  });
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
  });
  await Promise.all([workerMain.run(), workerScrapper.run()]);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
