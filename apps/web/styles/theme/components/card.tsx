import type { Components, Theme } from "@mui/joy/styles";

export const JoyCard = {
  styleOverrides: {
    root: {
      borderRadius: "var(--joy-radius-lg)",
      boxShadow: "var(--joy-shadow-xs)",
    },
  },
} satisfies Components<Theme>["JoyCard"];
