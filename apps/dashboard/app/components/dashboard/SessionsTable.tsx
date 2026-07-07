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
import { countryFlagEmoji, formatSessionDevice } from "@/lib/session-display";

export type SessionsTableRow = {
  id: string;
  session_id: string;
  user_id?: string | null;
  anonymous_id?: string | null;
  user_email?: string | null;
  country?: string | null;
  device_browser?: string | null;
  device_os?: string | null;
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
  const email = row.user_email?.trim();
  if (!identity && !email) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      {email ? (
        <span title={email} className="block truncate text-[13px]">
          {truncate(email, 28)}
        </span>
      ) : null}
      {identity ? (
        <span title={identity} className="block truncate font-mono text-[13px] text-muted-foreground">
          {truncate(identity, 24)}
        </span>
      ) : null}
    </div>
  );
}

function CountryCell({ country }: { country?: string | null }) {
  if (!country?.trim()) return <span className="text-muted-foreground">—</span>;
  const flag = countryFlagEmoji(country);
  return (
    <span title={country} className="tabular-nums text-[13px]">
      {flag ? <span className="mr-1.5">{flag}</span> : null}
      {country.toUpperCase()}
    </span>
  );
}

function DeviceCell({
  browser,
  os,
}: {
  browser?: string | null;
  os?: string | null;
}) {
  const label = formatSessionDevice(browser, os);
  if (!label) return <span className="text-muted-foreground">—</span>;
  return (
    <span title={label} className="text-[13px]">
      {truncate(label, 28)}
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
    <div className="min-w-0 max-w-[8rem]">
      <div className="flex items-center justify-between gap-2">
        <span className="whitespace-nowrap tabular-nums text-[13px]">{label}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface"
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
            <th className="hidden md:table-cell">Country</th>
            <th className="hidden lg:table-cell">Device</th>
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
              <td className="min-w-0 max-w-[9rem]">
                <TableListLink
                  href={hrefForSession(row)}
                  className="block min-w-0 max-w-full space-y-1 break-normal"
                  title={row.session_id}
                >
                  <SessionIdentity row={row} />
                  <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">
                    {truncate(row.session_id, 18)}
                  </span>
                </TableListLink>
              </td>
              <td className="hidden md:table-cell">
                <CountryCell country={row.country} />
              </td>
              <td className="hidden lg:table-cell max-w-[9rem]">
                <DeviceCell browser={row.device_browser} os={row.device_os} />
              </td>
              <td className="min-w-0">
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
