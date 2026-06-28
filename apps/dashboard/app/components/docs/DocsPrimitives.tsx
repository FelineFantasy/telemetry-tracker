import type { ReactNode } from "react";
import { DocsCodeBlock } from "./DocsCodeBlock";

export function DocsSection({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-16 scroll-mt-32">
      <div className="flex items-baseline gap-3 border-t border-border pt-10">
        <span className="font-mono text-[11px] text-muted-foreground">{eyebrow}</span>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h2>
      </div>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-foreground/85 [&>p]:max-w-2xl">
        {children}
      </div>
    </section>
  );
}

export function DocsSteps({ children }: { children: ReactNode }) {
  return <ol className="mt-6 space-y-6">{children}</ol>;
}

export function DocsStep({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="grid gap-3 sm:grid-cols-[2rem_1fr]">
      <span className="grid h-7 w-7 place-items-center rounded-full border border-border bg-surface font-mono text-xs text-foreground">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-medium tracking-tight">{title}</p>
        <div className="mt-3">{children}</div>
      </div>
    </li>
  );
}

export function DocsInlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
  );
}

export function DocsDefinitions({
  items,
}: {
  items: { term: string; def: string }[];
}) {
  const lastOdd = items.length % 2 === 1;
  return (
    <dl className="mt-2 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
      {items.map((i, idx) => (
        <div
          key={i.term}
          className={`bg-background p-5${lastOdd && idx === items.length - 1 ? " sm:col-span-2" : ""}`}
        >
          <dt className="text-[13px] font-medium tracking-tight text-foreground">{i.term}</dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{i.def}</dd>
        </div>
      ))}
    </dl>
  );
}

export { DocsCodeBlock };
