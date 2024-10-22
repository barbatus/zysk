"use client";

import type { EmotionCache } from "@emotion/cache";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { type ReactNode, useEffect } from "react";
import stylisRTLPlugin from "stylis-plugin-rtl";

import type { Direction } from "#/styles/theme/types";

function styleCache(): EmotionCache {
  return createCache({
    key: "rtl",
    prepend: true,
    stylisPlugins: [stylisRTLPlugin],
  });
}

export interface RTLProps {
  children: ReactNode;
  direction?: Direction;
}

export function Rtl({ children, direction = "ltr" }: RTLProps) {
  useEffect(() => {
    document.dir = direction;
  }, [direction]);

  if (direction === "rtl") {
    return <CacheProvider value={styleCache()}>{children}</CacheProvider>;
  }

  return <>{children}</>;
}
