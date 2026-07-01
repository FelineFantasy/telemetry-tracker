"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

const THEME_COLORS = {
  light: "#fafafa",
  dark: "#0a0a0a",
} as const;

export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute(
      "content",
      resolvedTheme === "light" ? THEME_COLORS.light : THEME_COLORS.dark
    );
  }, [resolvedTheme]);

  return null;
}
