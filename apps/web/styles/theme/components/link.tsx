import type { Components, Theme } from "@mui/joy/styles";

export const JoyLink = {
  styleOverrides: {
    root: {
      textDecorationColor: "var(--joy-palette-text-primary)",
      "&:hover": { color: "var(--joy-palette-text-primary)" },
    },
  },
} satisfies Components<Theme>["JoyLink"];
