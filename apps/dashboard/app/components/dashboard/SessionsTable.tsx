import { TimeAgo } from "@/app/components/TimeAgo";
import { SessionStatusBadge } from "@/app/components/dashboard/analytics-ui";
import {
  Table,
  TableListLink,
  TableViewLink,
  TableWrap,
  tableDateColumnClass,
} from "@/app/components/ui/Table";
import { formatDurationSec } from "@/lib/format-duration";

export type SessionsTableRow = {
  id: string;
  session_id: string;
  user_id?: string | null;
  anonymous_id?: string | null;
  started_at: string;
  duration_sec: number;
  event_count: number;
  page_count: number;
  status: "healthy" | "warning";
  max_duration_sec?: number | null;
};

function truncate(s: string, len: number) {
  return s.length <= len ? s : s.slice(0, len) + "\u2026";
}

function SessionIdentity({ row }: { row: SessionsTableRow }) {
  const identity = row.user_id ?? row.anonymous_id;
  if (!identity) return <span className="text-muted-foreground">—</span>;
  return (
    <span title={identity} className="font-mono text-[13px]">
      {truncate(identity, 24)}
    </span>
  );
}

function DurationCell({
  durationSec,
  maxDurationSec,
}: {
  durationSec: number;
  maxDurationSec: number;
}) {
  const label = formatDurationSec(durationSec);
  const pct =
    maxDurationSec > 0
      ? Math.min(100, Math.round((durationSec / maxDurationSec) * 100))
      : 0;

  return (
    <div className="min-w-[7rem]">
      <div className="flex items-center justify-between gap-2">
        <span className="tabular-nums text-[13px]">{label}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full max-w-[8rem] overflow-hidden rounded-full bg-surface"
        role="presentation"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-brand/70"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SessionsTable({
  rows,
  hrefForSession,
  hrefForView,
  maxDurationSec,
}: {
  rows: SessionsTableRow[];
  hrefForSession: (row: SessionsTableRow) => string;
  hrefForView: (row: SessionsTableRow) => string;
  maxDurationSec?: number;
}) {
  const pageMax =
    maxDurationSec ??
    rows.reduce((max, row) => Math.max(max, row.duration_sec), 0);

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <th>User</th>
            <th>Duration</th>
            <th className="hidden sm:table-cell text-right">Pages / Events</th>
            <th className={tableDateColumnClass}>Started</th>
            <th className="hidden md:table-cell">Status</th>
            <th className="hidden sm:table-cell" aria-hidden>
              View
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="max-w-[10rem]">
                <div className="space-y-1">
                  <SessionIdentity row={row} />
                  <TableListLink
                    href={hrefForSession(row)}
                    className="block font-mono text-[11px] text-muted-foreground"
                    title={row.session_id}
                  >
                    {truncate(row.session_id, 18)}
                  </TableListLink>
                </div>
              </td>
              <td>
                <DurationCell durationSec={row.duration_sec} maxDurationSec={pageMax} />
              </td>
              <td className="hidden sm:table-cell text-right tabular-nums">
                <span title="Distinct pages / total events">
                  {row.page_count.toLocaleString()} / {row.event_count.toLocaleString()}
                </span>
              </td>
              <td className={tableDateColumnClass}>
                <TimeAgo iso={row.started_at} />
              </td>
              <td className="hidden md:table-cell">
                <SessionStatusBadge status={row.status} />
              </td>
              <td className="hidden sm:table-cell">
                <TableViewLink href={hrefForView(row)} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}
