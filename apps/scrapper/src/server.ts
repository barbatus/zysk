import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { z } from "zod";

import { scrapeQueue } from "./queue";

const server: FastifyInstance = Fastify({
  logger: true,
});

// Schema for the scrape request
const scrapeRequestSchema = z.object({
  url: z.string().url(),
  useBrowserApi: z.boolean().optional(),
  useProxy: z.boolean().optional(),
  convertToMd: z.boolean().optional(),
  waitFor: z.number().optional(),
  timeout: z.number().optional(),
});

type ScrapeRequest = z.infer<typeof scrapeRequestSchema>;

// Schema for the job status response
const jobStatusResponseSchema = z.object({
  id: z.string(),
  status: z.enum(["completed", "failed", "pending"]),
  error: z.string().optional(),
  errorStatus: z.number().optional(),
  returnValue: z
    .object({
      url: z.string(),
      content: z.string(),
    })
    .optional(),
});

type JobStatusResponse = z.infer<typeof jobStatusResponseSchema>;

server.post<{ Body: ScrapeRequest }>(
  "/scrape",
  async (
    request: FastifyRequest<{ Body: ScrapeRequest }>,
    reply: FastifyReply,
  ) => {
    try {

      const data = scrapeRequestSchema.parse(request.body);
      const job = await scrapeQueue.add("scrape", data);

      return {
        jobId: job.id,
        status: "queued",
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: "Invalid request request",
          details: error.errors,
        });
      }
      throw error;
    }
  },
);

server.get<{ Params: { id: string } }>(
  "/job/:id",
  async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = request.params;

    try {
      const job = await scrapeQueue.getJob(id);

      if (!job) {
        return reply.status(404).send({
          error: "Job not found",
        });
      }

      const state = await job.getState();
      const result = job.returnvalue as
        | {
            content?: string;
            error?: string;
            url?: string;
            errorStatus?: number;
          }
        | undefined;

      const isFailed = state === "failed";
      const isCompleted = state === "completed";

      if (isFailed) {
        return reply.status(result?.errorStatus ?? 500).send({
          error: result?.error ?? "Job failed",
        });
      }

      if (result?.errorStatus) {
        return reply.status(result.errorStatus).send({
          error: result.error ?? "Failed to scrape",
        });
      }

      const response: JobStatusResponse = {
        id: job.id!,
        status: isCompleted ? state : "pending",
        returnValue: result
          ? { content: result.content!, url: result.url! }
          : undefined,
      };

      return response;
    } catch (error) {
      server.log.error(error);
      return reply.status(500).send({
        error: "Failed to get job status",
      });
    }
  },
);

// Start the server
const start = async () => {
  try {
    await server.listen({ port: 3002, host: "0.0.0.0" });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

void start();
