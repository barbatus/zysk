import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const AdminScriptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  arguments: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      required: z.boolean(),
      defaultValue: z.string().optional(),
    }),
  ),
  options: z.array(
    z.object({ name: z.string(), description: z.string().optional() }),
  ),
});
export type AdminScript = z.infer<typeof AdminScriptSchema>;

const ExecuteAdminScriptSettingsSchema = z.object({
  name: z.string(),
  arguments: z.array(
    z.object({ name: z.string(), value: z.string().optional() }),
  ),
  options: z.record(z.string(), z.boolean()),
});
export type ExecuteAdminScriptSettings = z.infer<
  typeof ExecuteAdminScriptSettingsSchema
>;

export const adminContract = c.router(
  {
    getAdminScripts: {
      method: "GET",
      path: "scripts",
      responses: {
        200: z.array(AdminScriptSchema),
      },
    },
    executeAdminScript: {
      method: "POST",
      path: "scripts/:name",
      pathParams: z.object({
        name: z.string(),
      }),
      body: ExecuteAdminScriptSettingsSchema,
      responses: {
        200: z.object({
          result: z.unknown().optional(),
          error: z.unknown().optional(),
        }),
        500: z.object({
          error: z.string(),
        }),
      },
    },
  },
  {
    pathPrefix: "/api/v1/admin/",
  },
);
