import type { Components, Theme } from "@mui/joy/styles";

export const JoyModal = {
  styleOverrides: { backdrop: { backdropFilter: "none" } },
} satisfies Components<Theme>["JoyModal"];
