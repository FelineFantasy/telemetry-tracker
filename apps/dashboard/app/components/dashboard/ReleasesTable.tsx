import Link from "next/link";
import { TimeAgo } from "@/app/components/TimeAgo";
import {
  Table,
  TableWrap,
  tableDateColumnClass,
} from "@/app/components/ui/Table";
import {
  releaseVsPreviousDeltaClass,
  type ReleaseHealthRow,
} from "@/lib/releases-summary";
import { formatPct } from "@/lib/overview-format";
import {
  buildDashboardScopedListHref,
  type DashboardListScope,
  UNKNOWN_RELEASE_KEY,
} from "@/lib/overview-scope-url";

function formatCount(n: number): string {
  return n.toLocaleString();
}

function DeltaLine({
  label,
  value,
  kind,
  /** When true, higher is bad (error rate / errors). Default: higher is good. */
  invert = false,
}: {
  label: string;
  value: number | null | undefined;
  kind: "pp" | "pct";
  invert?: boolean;
}) {
  if (value == null) return null;
  const sign = value > 0 ? "↑" : value < 0 ? "↓" : "→";
  const abs = Math.abs(value);
  const formatted = kind === "pp" ? `${abs} pp` : `${abs}%`;
  const tone = releaseVsPreviousDeltaClass(value, invert);
  return (
    <div className={`text-[11px] tabular-nums ${tone}`}>
      {label} {sign} {formatted}
    </div>
  );
}

function ReleaseLinks({
  releaseKey,
  scope,
}: {
  releaseKey: string;
  scope: DashboardListScope;
}) {
  const releaseScope: DashboardListScope = { ...scope, release: releaseKey };
  const issuesHref = buildDashboardScopedListHref("/dashboard/errors", releaseScope);
  const eventsHref = buildDashboardScopedListHref("/dashboard/events", releaseScope);
  const sessionsHref = buildDashboardScopedListHref("/dashboard/sessions", releaseScope);
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[12px]">
      <Link href={issuesHref} className="text-muted-foreground underline-offset-4 hover:text-brand hover:underline">
        Issues
      </Link>
      <Link href={eventsHref} className="text-muted-foreground underline-offset-4 hover:text-brand hover:underline">
        Events
      </Link>
      <Link href={sessionsHref} className="text-muted-foreground underline-offset-4 hover:text-brand hover:underline">
        Sessions
      </Link>
    </div>
  );
}

export function ReleasesTable({
  items,
  scope,
}: {
  items: ReleaseHealthRow[];
  scope: DashboardListScope;
}) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <th>Release</th>
            <th className={tableDateColumnClass}>First seen</th>
            <th className={`hidden md:table-cell ${tableDateColumnClass}`}>Last seen</th>
            <th className="text-right">Sessions</th>
            <th className="hidden sm:table-cell text-right">Users</th>
            <th className="hidden lg:table-cell text-right">Events</th>
            <th className="text-right">Errors</th>
            <th className="text-right">Error rate</th>
            <th className="text-right">Adoption</th>
            <th className="hidden sm:table-cell">Open</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const label =
              row.releaseKey === UNKNOWN_RELEASE_KEY ? "Unknown" : row.releaseKey;
            const vs = row.vsPrevious;
            return (
              <tr key={row.releaseKey}>
                <td>
                  <div className="font-medium text-foreground">{label}</div>
                  {vs ? (
                    <div className="mt-1 space-y-0.5">
                      <DeltaLine label="Error rate" value={vs.errorRatePp} kind="pp" invert />
                      <DeltaLine label="Sessions" value={vs.sessionsPct} kind="pct" />
                      <DeltaLine label="Errors" value={vs.errorsPct} kind="pct" invert />
                    </div>
                  ) : null}
                </td>
                <td className={tableDateColumnClass}>
                  <TimeAgo iso={row.firstSeenAt} />
                </td>
                <td className={`hidden md:table-cell ${tableDateColumnClass}`}>
                  <TimeAgo iso={row.lastSeenAt} />
                </td>
                <td className="text-right tabular-nums">{formatCount(row.sessions)}</td>
                <td className="hidden sm:table-cell text-right tabular-nums">
                  {formatCount(row.activeUsers)}
                </td>
                <td className="hidden lg:table-cell text-right tabular-nums">
                  {formatCount(row.events)}
                </td>
                <td className="text-right tabular-nums">{formatCount(row.errors)}</td>
                <td className="text-right tabular-nums">
                  {row.errorRatePct == null ? "—" : formatPct(row.errorRatePct, 1)}
                </td>
                <td className="text-right tabular-nums">
                  {formatPct(row.adoptionSharePct, 1)}
                </td>
                <td className="hidden sm:table-cell">
                  <ReleaseLinks releaseKey={row.releaseKey} scope={scope} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrap>
  );
}
