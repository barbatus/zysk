"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { type metricsApi } from "#/api/metrics";
import { type portfolioApi } from "#/api/portfolio";

export function ReactQueryProvider({
  children,
  apis,
}: {
  children: React.ReactNode;
  apis: (typeof metricsApi | typeof portfolioApi)[];
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {apis.map((api, index) => (
        <api.ReactQueryProvider key={index}>{children}</api.ReactQueryProvider>
      ))}
    </QueryClientProvider>
  );
}
