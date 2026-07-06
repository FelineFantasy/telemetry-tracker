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
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="line-clamp-4 break-all text-xl font-semibold tracking-tight sm:line-clamp-3 sm:break-words sm:text-2xl lg:text-3xl">
          {title}
        </h1>
        {context ? (
          <p className="mt-1.5 max-w-3xl break-words text-sm text-muted-foreground">{context}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
