"use client";

import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import { metricsContract } from "@zysk/ts-rest";

export const metricsApi = initTsrReactQuery(metricsContract, {
  baseUrl: process.env.NEXT_PUBLIC_API_HOST_URL!,
  jsonQuery: true,
});
