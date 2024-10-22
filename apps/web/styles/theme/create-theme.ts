import type { Theme } from "@mui/joy/styles";
import { extendTheme } from "@mui/joy/styles";

import { colorSchemes } from "./color-schemes";
import { components } from "./components/components";
import type { Direction, PrimaryColor } from "./types";
import { typography } from "./typography";

declare module "@mui/joy/styles" {
  interface PaletteRange {
    950?: string;
  }

  interface Palette {
    gradient: { 1: string; 2: string; 3: string; 4: string };
  }
}

declare module "@mui/joy/Table" {
  interface TablePropsBorderAxisOverrides {
    header: true;
  }
}

declare module "@mui/joy/Tabs" {
  interface TabsPropsVariantOverrides {
    custom: true;
  }
}

interface Config {
  primaryColor: PrimaryColor;
  direction?: Direction;
}

export function createTheme(config: Config): Theme {
  return extendTheme({
    colorSchemes: colorSchemes({ primaryColor: config.primaryColor }),
    components,
    direction: config.direction,
    fontFamily: {
      body: "'Be Vietnam Pro', var(--joy-fontFamily-fallback)",
      code: "'Roboto Mono', var(--joy-fontFamily-fallback)",
      display: "'Inter', var(--joy-fontFamily-fallback)",
    },
    typography,
  });
}
