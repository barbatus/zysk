import type { Components, Theme } from "@mui/joy/styles";

export const JoyDrawer = {
  styleOverrides: { backdrop: { backdropFilter: "none" } },
} satisfies Components<Theme>["JoyDrawer"];
