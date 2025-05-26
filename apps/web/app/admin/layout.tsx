import { type ReactNode } from "react";

import { metricsApi } from "#/api/metrics";
import { watchlistApi } from "#/api/watchlist";

import { PageLayout } from "../common/page-layout";
import { ReactQueryProvider } from "../common/react-query-provider";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <ReactQueryProvider apis={[metricsApi, watchlistApi]}>
      <PageLayout>{children}</PageLayout>
    </ReactQueryProvider>
  );
}
