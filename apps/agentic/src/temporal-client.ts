import { Client, Connection } from "@temporalio/client";
import { getAgenticConfigStatic } from "@zysk/services";

let clientInstance: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (clientInstance) {
    return clientInstance;
  }

  const config = getAgenticConfigStatic();

  const connectionOptions: Parameters<typeof Connection.connect>[0] = {
    address: config.temporal.address,
  };

  if (config.temporal.tls) {
    connectionOptions.tls = true;
  }

  if (config.temporal.apiKey) {
    connectionOptions.apiKey = config.temporal.apiKey;
  }

  const connection = await Connection.connect(connectionOptions);

  clientInstance = new Client({
    connection,
    namespace: config.temporal.namespace,
  });

  return clientInstance;
}

export async function startWorkflow<T extends unknown[]>(
  workflowName: string,
  args: T,
  workflowId?: string,
) {
  const config = getAgenticConfigStatic();
  const client = await getTemporalClient();

  const handle = await client.workflow.start(workflowName, {
    workflowId: workflowId ?? `${workflowName}-${Date.now()}`,
    taskQueue: config.temporal.taskQueue,
    args,
  });

  return handle;
}
