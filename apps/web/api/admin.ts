"use client";

import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import { adminContract } from "@zysk/ts-rest";

export const adminApi = initTsrReactQuery(adminContract, {
  baseUrl: process.env.NEXT_PUBLIC_API_HOST_URL!,
  jsonQuery: true,
});

export const useAdminScripts = () => {
  return adminApi.getAdminScripts.useQuery({
    queryKey: ["admin-scripts"],
    select: (d) => d.body,
  });
};

export const useExecuteAdminScript = () => {
  return adminApi.executeAdminScript.useMutation();
};
