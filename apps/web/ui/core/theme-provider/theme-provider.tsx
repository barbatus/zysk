"use client";

import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";
import * as React from "react";

import { createTheme } from "#/styles/theme/create-theme";

import { NextAppDirEmotionCacheProvider } from "./emotion-cache";
import { Rtl } from "./rtl";
import { schemaSettings } from "./settings";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = createTheme({ ...schemaSettings, direction: "ltr" });

  return (
    <NextAppDirEmotionCacheProvider options={{ key: "joy" }}>
      <CssVarsProvider
        defaultColorScheme={schemaSettings.colorSchema}
        defaultMode={schemaSettings.colorSchema}
        theme={theme}
      >
        <CssBaseline />
        <Rtl direction="ltr">{children}</Rtl>
      </CssVarsProvider>
    </NextAppDirEmotionCacheProvider>
  );
}
