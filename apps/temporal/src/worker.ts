import { NativeConnection, Worker } from "@temporalio/worker";

import * as activities from "./activities";

async function run() {
  const connection = await NativeConnection.connect({
    address: "localhost:7233",
  });
  const worker = await Worker.create({
    connection,
    taskQueue: "zysk-data",
    workflowsPath: require.resolve("./workflows/index"),
    activities,
  });
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
