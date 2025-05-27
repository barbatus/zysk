import { type ReactNode } from "react";

import { watchlistApi } from "#/api/watchlist";

import { PageLayout } from "../common/page-layout";
import { ReactQueryProvider } from "../common/react-query-provider";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <ReactQueryProvider apis={[watchlistApi]}>
      <PageLayout>{children}</PageLayout>
    </ReactQueryProvider>
  );
}
