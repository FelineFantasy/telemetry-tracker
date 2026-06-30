import Link from "next/link";
import type { ReactNode } from "react";

export function ComingSoonPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <span className="inline-flex rounded-full border border-border bg-surface/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Coming soon
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {children}
      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/dashboard/overview" className="text-brand hover:underline">
          ← Back to Overview
        </Link>
      </p>
    </div>
  );
}
