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

function readChartColors(): ChartColors {
  if (typeof window === "undefined") {
    return {
      grid: "rgba(148, 163, 184, 0.12)",
      axis: "rgba(148, 163, 184, 0.2)",
      tick: "#64748b",
      tooltipBg: "#ffffff",
      tooltipBorder: "rgba(15, 23, 42, 0.12)",
      tooltipFg: "#0f172a",
      tooltipLabel: "#475569",
      legend: "#64748b",
      cursor: "rgba(103, 79, 220, 0.08)",
      error: "#f87171",
      event: "#674fdc",
    };
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
