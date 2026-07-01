"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export type ChartColors = {
  grid: string;
  axis: string;
  tick: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipFg: string;
  tooltipLabel: string;
  legend: string;
  cursor: string;
  error: string;
  event: string;
};

const CHART_VAR_KEYS: Record<keyof ChartColors, string> = {
  grid: "--chart-grid",
  axis: "--chart-axis",
  tick: "--chart-tick",
  tooltipBg: "--chart-tooltip-bg",
  tooltipBorder: "--chart-tooltip-border",
  tooltipFg: "--chart-tooltip-fg",
  tooltipLabel: "--chart-tooltip-label",
  legend: "--chart-legend",
  cursor: "--chart-cursor",
  error: "--chart-error",
  event: "--chart-event",
};

/** Matches `.dark` chart tokens in globals.css — defaultTheme is dark. */
const DARK_CHART_COLORS_FALLBACK: ChartColors = {
  grid: "oklch(1 0 0 / 10%)",
  axis: "oklch(1 0 0 / 16%)",
  tick: "oklch(0.82 0.02 280)",
  tooltipBg: "oklch(0.28 0.03 280)",
  tooltipBorder: "oklch(0.45 0.03 280)",
  tooltipFg: "oklch(0.96 0.01 260)",
  tooltipLabel: "oklch(0.88 0.02 280)",
  legend: "oklch(0.82 0.02 280)",
  cursor: "oklch(0.52 0.19 280 / 12%)",
  error: "oklch(0.72 0.2 25)",
  event: "oklch(0.58 0.2 280)",
};

function readChartColors(): ChartColors {
  if (typeof window === "undefined") {
    return DARK_CHART_COLORS_FALLBACK;
  }
  const styles = getComputedStyle(document.documentElement);
  const read = (key: keyof ChartColors) =>
    styles.getPropertyValue(CHART_VAR_KEYS[key]).trim();
  return {
    grid: read("grid"),
    axis: read("axis"),
    tick: read("tick"),
    tooltipBg: read("tooltipBg"),
    tooltipBorder: read("tooltipBorder"),
    tooltipFg: read("tooltipFg"),
    tooltipLabel: read("tooltipLabel"),
    legend: read("legend"),
    cursor: read("cursor"),
    error: read("error"),
    event: read("event"),
  };
}

export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<ChartColors>(() => readChartColors());

  useEffect(() => {
    setColors(readChartColors());
  }, [resolvedTheme]);

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readChartColors()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}

export function chartTooltipStyle(colors: ChartColors) {
  return {
    background: colors.tooltipBg,
    border: `1px solid ${colors.tooltipBorder}`,
    borderRadius: "8px",
    fontSize: "12px",
    color: colors.tooltipFg,
  };
}
