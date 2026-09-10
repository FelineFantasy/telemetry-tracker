import type { ReactNode } from "react";

export function PageTitle({
  title,
  context,
  actions,
}: {
  title: string;
  context?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="line-clamp-4 break-all text-2xl font-semibold tracking-tight sm:line-clamp-3 sm:break-words">
          {title}
        </h1>
        {context ? (
          <p className="mt-0.5 max-w-3xl break-words text-sm text-muted-foreground">{context}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
