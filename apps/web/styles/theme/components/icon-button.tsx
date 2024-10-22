import type { Components, Theme } from "@mui/joy/styles";

export const JoyIconButton = {
  styleOverrides: {
    root: ({ ownerState }) => ({
      ...(ownerState.variant === "outlined" && {
        boxShadow: "var(--joy-shadow-sm)",
      }),
      ...(ownerState.variant === "solid" &&
        ownerState.color === "neutral" && {
          "--variant-solidBg": "var(--joy-palette-neutral-900)",
          "--variant-solidHoverBg": "var(--joy-palette-neutral-700)",
        }),
    }),
  },
} satisfies Components<Theme>["JoyIconButton"];
