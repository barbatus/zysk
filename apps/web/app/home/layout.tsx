import Box from "@mui/joy/Box";
import GlobalStyles from "@mui/joy/GlobalStyles";
import { type ReactNode } from "react";

import { metricsApi } from "#/api/metrics";

import { ReactQueryProvider } from "../common/react-query-provider";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <ReactQueryProvider apis={[metricsApi]}>
      <GlobalStyles
        styles={{
          '[data-joy-color-scheme="dark"]': {
            "--Layout-bg": "var(--joy-palette-common-black)",
          },
          '[data-joy-color-scheme="light"]': {
            "--Layout-bg": "var(--joy-palette-neutral-900)",
          },
          body: {
            "--Layout-gap": "24px",
            "--MainNav-height": "72px",
            "--MainNav-zIndex": 1000,
            "--SideNav-width": "320px",
            "--SideNav-zIndex": 1100,
            "--MobileNav-width": "320px",
            "--MobileNav-zIndex": 1100,
            // When RTL is used, for some reason, Global styles are applied before default styles.
            // The !important is needed to override this behavior.
            background: "var(--Layout-bg) !important",
          },
        }}
      />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100%",
          pb: { lg: "var(--Layout-gap)" },
          pl: { lg: "var(--SideNav-width)" },
          pr: { lg: "var(--Layout-gap)" },
        }}
      >
        <Box
          sx={{
            "--Content-background": "var(--joy-palette-background-body)",
            "--Content-radius": "var(--joy-radius-xl)",
            "--Content-paddingX": "24px",
            "--Content-paddingY": "24px",
            "--Content-padding":
              "var(--Content-paddingY) var(--Content-paddingX)",
            bgcolor: "var(--Content-background)",
            borderRadius: { lg: "var(--Content-radius)" },
            display: "flex",
            flex: "1 1 auto",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <Box
            component="main"
            sx={{ display: "flex", flex: "1 1 auto", flexDirection: "column" }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </ReactQueryProvider>
  );
}
