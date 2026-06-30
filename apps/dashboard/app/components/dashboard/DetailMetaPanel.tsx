import type { ReactNode } from "react";

export function DetailMetaPanel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-surface/40 p-5 ${className}`}>
      <h2 className="mb-4 text-sm font-medium">{title}</h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

export function DetailMetaItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all font-mono text-[12.5px] text-foreground/90">{value}</dd>
    </div>
  );
}

export function DetailSummaryPanel({
  title,
  badges,
  meta,
  children,
}: {
  title: string;
  badges?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface/40 p-5" aria-label={title}>
      <h2 className="text-[15px] font-medium leading-snug text-destructive">{title}</h2>
      {badges ? <div className="mt-3 flex flex-wrap gap-2">{badges}</div> : null}
      {meta ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{meta}</div> : null}
      {children}
    </section>
  );
}

export function DetailMetaChip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm tabular-nums">{children}</div>
    </div>
  );
}

export function OccurrencePanel({ children }: { children: ReactNode }) {
  return (
    <li className="rounded-xl border border-border bg-surface/40 p-4">{children}</li>
  );
}
