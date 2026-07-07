import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, ResolvedBadge } from "@/app/components/Badge";
import { TimeAgo } from "@/app/components/TimeAgo";
import {
  AnalyticsPanel,
  AnalyticsPanelList,
  IssueStatusBadge,
} from "@/app/components/dashboard/analytics-ui";
import {
  Table,
  TableListLink,
  TableViewLink,
  TableWrap,
  tableDateColumnClass,
} from "@/app/components/ui/Table";

export function IssueList({ children }: { children: ReactNode }) {
  return (
    <AnalyticsPanel>
      <AnalyticsPanelList>{children}</AnalyticsPanelList>
    </AnalyticsPanel>
  );
}

export function IssueListItem({
  href,
  message,
  app,
  environment,
  resolved,
  topStack,
  meta,
}: {
  href: string;
  message: string;
  app: string;
  environment?: string | null;
  resolved?: boolean;
  topStack?: string;
  meta: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block px-4 py-3.5 transition-colors hover:bg-surface/60 sm:px-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{app}</Badge>
          {environment ? <Badge>{environment}</Badge> : null}
          {resolved ? <ResolvedBadge /> : null}
        </div>
        <p className="mt-2 line-clamp-2 break-all text-[14px] font-medium text-destructive">
          {message}
        </p>
        {topStack ? (
          <pre className="mt-2 max-h-20 overflow-hidden break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
            {topStack}
          </pre>
        ) : null}
        <p className="mt-2 break-words font-mono text-[11px] text-muted-foreground">{meta}</p>
      </Link>
    </li>
  );
}

export function OverviewListItem({
  href,
  title,
  badges,
  meta,
  titleClassName = "font-medium text-foreground",
}: {
  href: string;
  title: string;
  badges?: ReactNode;
  meta: ReactNode;
  titleClassName?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block px-4 py-3 transition-colors hover:bg-surface/60 sm:px-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
            <p className={`mt-1 line-clamp-2 break-all text-[13px] ${titleClassName}`}>{title}</p>
            <div className="mt-1 break-words text-[12px] text-muted-foreground">{meta}</div>
          </div>
        </div>
      </Link>
    </li>
  );
}

type IssuesTableRow = {
  id: string;
  message: string;
  app: string;
  environment?: string | null;
  occurrences: number;
  occurrences_in_range?: number;
  last_seen: string;
  resolved_at?: string | null;
  users_affected?: number;
};

export function IssuesTable({
  rows,
  hrefForRow,
}: {
  rows: IssuesTableRow[];
  hrefForRow: (row: IssuesTableRow) => string;
}) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <th>Error</th>
            <th className="hidden md:table-cell">App</th>
            <th className="hidden lg:table-cell">Environment</th>
            <th className="hidden sm:table-cell">Status</th>
            <th className="text-right">Count</th>
            <th className={tableDateColumnClass}>Last seen</th>
            <th className="hidden sm:table-cell" aria-hidden>
              View
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="max-w-xs sm:max-w-md">
                <TableListLink href={hrefForRow(row)} className="line-clamp-2 text-destructive">
                  {row.message}
                </TableListLink>
              </td>
              <td className="hidden md:table-cell">
                <Badge>{row.app}</Badge>
              </td>
              <td className="hidden lg:table-cell">
                {row.environment ? <Badge>{row.environment}</Badge> : "—"}
              </td>
              <td className="hidden sm:table-cell">
                <IssueStatusBadge resolved={Boolean(row.resolved_at)} />
              </td>
              <td className="text-right tabular-nums">
                {(row.occurrences_in_range ?? row.occurrences).toLocaleString()}
              </td>
              <td className={tableDateColumnClass}>
                <TimeAgo iso={row.last_seen} />
              </td>
              <td className="hidden sm:table-cell">
                <TableViewLink href={hrefForRow(row)} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

export function formatIssueMeta(parts: (string | ReactNode)[]) {
  return parts.filter(Boolean).join(" · ");
}

export { TimeAgo };
