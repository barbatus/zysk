import "#/styles/global.css";

import { type ReactNode } from "react";

import { schemaSettings } from "#/ui/core/theme-provider/settings";
import { ThemeProvider } from "#/ui/core/theme-provider/theme-provider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-joy-color-scheme={schemaSettings.colorSchema} lang="en">
      <body suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
