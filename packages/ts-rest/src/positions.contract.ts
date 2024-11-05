import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const PositionSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  amount: z.number(),
  openedAt: z.date(),
  closedAt: z.date().nullable(),
  openPrice: z.number().nullable(),
  closePrice: z.number().nullable(),
});

export type Position = z.infer<typeof PositionSchema>;

const PortfolioResponseSchema = z.array(PositionSchema);

export const portfolioContract = c.router(
  {
    queryWithFilter: {
      method: "GET",
      path: "query",
      responses: {
        200: PortfolioResponseSchema,
        400: z.object({
          error: z.string(),
        }),
      },
    },
  },
  {
    pathPrefix: "/api/v1/portfolio/",
  },
);
