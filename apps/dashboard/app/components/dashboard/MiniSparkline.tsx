"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useChartColors } from "@/lib/use-chart-colors";

export type SparklinePoint = {
  t: string;
  count: number | null;
};

type Props = {
  data: SparklinePoint[];
  color?: string;
  className?: string;
  ariaLabel?: string;
};

export function MiniSparkline({ data, color, className, ariaLabel }: Props) {
  const gradientId = useId().replace(/:/g, "");
  const colors = useChartColors();
  const stroke = color ?? colors.error;
  const chartData = data.map((p) => ({ value: p.count }));
  const hasData = chartData.some((p) => p.value != null && p.value > 0);

  if (!hasData) {
    return (
      <div
        className={className ?? "h-8 w-24"}
        aria-label={ariaLabel ?? "No trend data"}
        role="img"
      >
        <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
          —
        </div>
      </div>
    );
  }

  return (
    <div className={className ?? "h-8 w-24"} role="img" aria-label={ariaLabel ?? "Trend sparkline"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`sparkline-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            fill={`url(#sparkline-fill-${gradientId})`}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
