// import type { Metadata } from 'next';
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

import { UserSubscriptions } from "#/app/home/user-subscriptions";

// export const metadata = { title: `Overview | Dashboard | ${config.site.name}` } satisfies Metadata;

export default function Home() {
  return (
    <Box sx={{ p: "var(--Content-padding)" }}>
      <Stack spacing={3}>
        <div>
          <Typography fontSize={{ xs: "xl3", lg: "xl4" }} level="h1">
            Overview
          </Typography>
        </div>
        <UserSubscriptions />
      </Stack>
    </Box>
  );
}
