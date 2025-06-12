import { NativeConnection, Worker } from "@temporalio/worker";

import * as activities from "./activities";
import { scrapeNews } from "./workflows/stock-news/activities";

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
    workflowsPath: require.resolve("./workflows/scrapper/workflows"),
    activities: { scrapeNews },
    // 30 activities per minute
    maxActivitiesPerSecond: 0.5,
    // Up to 5 browsers per worker
    maxConcurrentActivityTaskExecutions: 5,
  });
  await Promise.all([workerMain.run(), workerScrapper.run()]);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
