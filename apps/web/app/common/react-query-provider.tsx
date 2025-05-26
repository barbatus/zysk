"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { type metricsApi } from "#/api/metrics";
import { type portfolioApi } from "#/api/portfolio";
import { type watchlistApi } from "#/api/watchlist";

export function ReactQueryProvider({
  children,
  apis,
}: {
  children: React.ReactNode;
  apis: (typeof metricsApi | typeof portfolioApi | typeof watchlistApi)[];
}) {
  const [queryClient] = useState(() => new QueryClient());

  if (!apis.length) return children;

  const api = apis[0];
  return (
    <QueryClientProvider client={queryClient}>
      <api.ReactQueryProvider>
        <ReactQueryProvider apis={apis.slice(1)}>{children}</ReactQueryProvider>
      </api.ReactQueryProvider>
    </QueryClientProvider>
  );
}
