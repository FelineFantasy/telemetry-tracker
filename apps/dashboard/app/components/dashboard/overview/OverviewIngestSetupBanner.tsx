import Link from "next/link";
import { KeyRound } from "lucide-react";
import { isUnselectedTimeRange } from "@/lib/time-range";

export function OverviewIngestSetupBanner({
  rangeKey,
  rangeLabel,
  eventsCount,
  errorsCount,
}: {
  rangeKey: string;
  rangeLabel: string;
  eventsCount: number;
  errorsCount: number;
}) {
  if (eventsCount > 0 || errorsCount > 0) return null;

  const title = isUnselectedTimeRange(rangeKey)
    ? "No telemetry recorded yet"
    : `No telemetry in selected window (${rangeLabel.toLowerCase()})`;

  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-xl border border-warning/35 bg-warning/10 px-4 py-3"
      role="status"
    >
      <KeyRound className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-muted-foreground">
          Data is shown by recency when no date filter is set. To send new events from your SDK,
          create an API key for the active project.
        </p>
        <Link
          href="/dashboard/settings/keys"
          className="mt-2 inline-block font-medium text-foreground underline-offset-4 hover:underline"
        >
          Set up API keys →
        </Link>
      </div>
    </div>
  );
}
