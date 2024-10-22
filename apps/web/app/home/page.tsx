// import type { Metadata } from 'next';
import Box from "@mui/joy/Box";
import Grid from "@mui/joy/Grid";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

import { TickerTable } from "./ticker-table";

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
        <Grid container spacing={3}>
          <Grid md={12} sx={{ "& > *": { height: "100%" } }} xs={12}>
            <TickerTable />
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}
