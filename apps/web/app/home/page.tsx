// import type { Metadata } from 'next';

import { Watchlist } from "#/app/home/watchlist";

// export const metadata = { title: `Overview | Dashboard | ${config.site.name}` } satisfies Metadata;

export default function Home() {
  return <Watchlist />;
}
