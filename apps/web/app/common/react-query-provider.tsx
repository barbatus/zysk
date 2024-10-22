"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { type metricsApi } from "#/api/metrics";

export function ReactQueryProvider({
  children,
  apis,
}: {
  children: React.ReactNode;
  apis: (typeof metricsApi)[];
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
