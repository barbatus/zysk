import type { Components, Theme } from "@mui/joy/styles";

export const JoySelect = {
  styleOverrides: {
    root: ({ ownerState }) => ({
      ...(ownerState.variant === "outlined" && {
        boxShadow: "var(--joy-shadow-xs)",
      }),
    }),
  },
} satisfies Components<Theme>["JoySelect"];
