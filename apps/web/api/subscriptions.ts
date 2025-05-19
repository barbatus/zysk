"use client";

import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import { subscriptionsContract } from "@zysk/ts-rest";

export const subscriptionsApi = initTsrReactQuery(subscriptionsContract, {
  baseUrl: process.env.NEXT_PUBLIC_API_HOST_URL!,
  jsonQuery: true,
});

export const useSubscriptions = () => {
  return subscriptionsApi.getSubscriptions.useQuery({
    queryKey: ["subscriptions"],
    select: (d) => d.body,
  });
};
