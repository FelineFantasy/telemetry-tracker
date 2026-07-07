import { Badge } from "@/app/components/Badge";
import { TimeAgo } from "@/app/components/TimeAgo";
import { MiniSparkline, type SparklinePoint } from "@/app/components/dashboard/MiniSparkline";
import {
  Table,
  TableListLink,
  TableViewLink,
  TableWrap,
  tableDateColumnClass,
} from "@/app/components/ui/Table";
import { formatPct } from "@/lib/overview-format";

export type EventsTableRow = {
  name: string;
  app: string;
  platform?: string | null;
  environment?: string | null;
  count_in_range: number;
  share_pct: number;
  users_affected?: number;
  last_seen: string;
  latest_event_id?: string | null;
  sparkline?: SparklinePoint[];
};

export function EventsTable({
  rows,
  hrefForName,
  hrefForView,
}: {
  rows: EventsTableRow[];
  hrefForName: (row: EventsTableRow) => string;
  hrefForView: (row: EventsTableRow) => string | null;
}) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <th>Event name</th>
            <th className="hidden md:table-cell">App</th>
            <th className="hidden lg:table-cell">Environment</th>
            <th className="hidden lg:table-cell">Platform</th>
            <th className="hidden md:table-cell text-right">Users</th>
            <th className="hidden lg:table-cell text-right">Trend</th>
            <th className="text-right">Count</th>
            <th className="hidden sm:table-cell text-right">Share</th>
            <th className={tableDateColumnClass}>Last seen</th>
            <th className="hidden sm:table-cell" aria-hidden>
              View
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const viewHref = hrefForView(row);
            return (
              <tr key={row.name}>
                <td className="max-w-xs sm:max-w-md">
                  <TableListLink href={hrefForName(row)} className="line-clamp-2">
                    {row.name}
                  </TableListLink>
                </td>
                <td className="hidden md:table-cell">
                  <Badge>{row.app}</Badge>
                </td>
                <td className="hidden lg:table-cell">
                  {row.environment ? <Badge>{row.environment}</Badge> : "—"}
                </td>
                <td className="hidden lg:table-cell">
                  {row.platform ? <Badge>{row.platform}</Badge> : "—"}
                </td>
                <td className="hidden md:table-cell text-right tabular-nums">
                  {(row.users_affected ?? 0).toLocaleString()}
                </td>
                <td className="hidden lg:table-cell text-right">
                  <div className="flex justify-end">
                    <MiniSparkline
                      data={row.sparkline ?? []}
                      color="var(--chart-event)"
                      className="h-8 w-24"
                      ariaLabel={`Trend for ${row.name}`}
                    />
                  </div>
                </td>
                <td className="text-right tabular-nums">
                  {(row.count_in_range ?? 0).toLocaleString()}
                </td>
                <td className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                  {formatPct(row.share_pct, 1)}
                </td>
                <td className={tableDateColumnClass}>
                  <TimeAgo iso={row.last_seen} />
                </td>
                <td className="hidden sm:table-cell">
                  {viewHref ? <TableViewLink href={viewHref} /> : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrap>
  );
}
