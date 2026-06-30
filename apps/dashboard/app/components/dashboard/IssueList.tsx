import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, ResolvedBadge } from "@/app/components/Badge";
import { TimeAgo } from "@/app/components/TimeAgo";

export function IssueList({ children }: { children: ReactNode }) {
  return <ul className="space-y-2">{children}</ul>;
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
        className="block rounded-xl border border-border bg-surface/40 p-4 transition-colors hover:bg-surface/70"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{app}</Badge>
          {environment ? <Badge>{environment}</Badge> : null}
          {resolved ? <ResolvedBadge /> : null}
        </div>
        <p className="mt-2 text-[15px] font-medium text-destructive">{message}</p>
        {topStack ? (
          <pre className="mt-2 max-h-24 overflow-hidden text-ellipsis font-mono text-[11px] leading-relaxed text-muted-foreground">
            {topStack}
          </pre>
        ) : null}
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">{meta}</p>
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
        className="block rounded-xl border border-border bg-surface/40 px-4 py-3 transition-colors hover:bg-surface/70"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {badges}
              <span className={`truncate ${titleClassName}`}>{title}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{meta}</div>
          </div>
        </div>
      </Link>
    </li>
  );
}

export function formatIssueMeta(parts: (string | ReactNode)[]) {
  return parts.filter(Boolean).join(" · ");
}

export { TimeAgo };
