import "#/styles/global.css";

import GlobalStyles from "@mui/joy/GlobalStyles";
import { type ReactNode } from "react";

import { schemaSettings } from "#/ui/core/theme-provider/settings";
import { ThemeProvider } from "#/ui/core/theme-provider/theme-provider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-joy-color-scheme={schemaSettings.colorSchema} lang="en">
      <body suppressHydrationWarning>
        <ThemeProvider>
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
                "--MobileNav-width": "320px",
                "--MobileNav-zIndex": 1100,
                // When RTL is used, for some reason, Global styles are applied before default styles.
                // The !important is needed to override this behavior.
                background: "var(--Layout-bg) !important",
              },
            }}
          />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
