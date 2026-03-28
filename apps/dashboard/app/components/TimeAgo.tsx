import { formatAbsoluteTime, formatRelativeTime } from "@/lib/format-time";

export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={formatAbsoluteTime(iso)} className={className ?? "tabular-nums"}>
      {formatRelativeTime(iso)}
    </time>
  );
}
