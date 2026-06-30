"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OverviewSeries, OverviewTimeSeriesPoint } from "@/lib/overview-api";
import { chartHasNoData } from "@/lib/overview-chart-series";
import { DashboardPanel } from "@/app/components/dashboard/dashboard-ui";

function formatBucketLabel(iso: string, bucket: "hour" | "day"): string {
  const d = new Date(iso);
  if (bucket === "day") {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function mergeErrorRateSeries(series: OverviewSeries): { t: string; pct: number }[] {
  return series.events.map((ev, i) => {
    const err = series.errors[i]?.count ?? 0;
    const total = ev.count + err;
    return {
      t: formatBucketLabel(ev.t, series.bucket),
      pct: total > 0 ? (err / total) * 100 : 0,
    };
  });
}

function mapSeries(points: OverviewTimeSeriesPoint[], bucket: "hour" | "day", unit: string) {
  return points.map((p) => ({
    t: formatBucketLabel(p.t, bucket),
    value: p.count,
    unit,
  }));
}

export function OverviewExtraCharts({
  series,
  sessionDurationSeries,
  rangeLabel,
}: {
  series: OverviewSeries;
  sessionDurationSeries: OverviewTimeSeriesPoint[];
  rangeLabel: string;
}) {
  const errorRate = mergeErrorRateSeries(series);
  const events = mapSeries(series.events, series.bucket, "events");
  const sessions = mapSeries(sessionDurationSeries, series.bucket, "s");

  const charts = [
    {
      id: "error-rate",
      title: "Error rate",
      subtitle: rangeLabel,
      data: errorRate,
      dataKey: "pct" as const,
      unit: "%",
      color: "#f87171",
    },
    {
      id: "event-volume",
      title: "Event volume",
      subtitle: rangeLabel,
      data: events,
      dataKey: "value" as const,
      unit: "events",
      color: "#60a5fa",
    },
    {
      id: "error-volume",
      title: "Error volume",
      subtitle: rangeLabel,
      data: mapSeries(series.errors, series.bucket, "errors"),
      dataKey: "value" as const,
      unit: "errors",
      color: "#fb923c",
    },
    {
      id: "avg-session-duration",
      title: "Avg session duration",
      subtitle: `${rangeLabel} · ended sessions only`,
      data: sessions,
      dataKey: "value" as const,
      unit: "s",
      color: "#34d399",
    },
  ];

  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="text-sm font-medium">Signals</h2>
        <p className="text-[12px] text-muted-foreground">Derived from project telemetry in this range</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {charts.map((c) => (
          <DashboardPanel key={c.id} className="p-4">
            <div className="mb-3">
              <h3 className="text-[13px] font-medium">{c.title}</h3>
              <p className="text-[11px] text-muted-foreground">{c.subtitle}</p>
            </div>
            <div className="h-[140px] w-full">
              {chartHasNoData(c.data, c.dataKey) ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No data in this period
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={c.data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`grad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={c.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                    <XAxis dataKey="t" tick={{ fill: "#888", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#888", fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v} ${c.unit}`, c.title]}
                    />
                    <Area
                      type="monotone"
                      dataKey={c.dataKey}
                      stroke={c.color}
                      fill={`url(#grad-${c.id})`}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </DashboardPanel>
        ))}
      </div>
    </section>
  );
}
