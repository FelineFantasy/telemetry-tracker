import Link from "next/link";
import type { ReactNode } from "react";
import { ComingSoonBadge } from "./coming-soon-ui";

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
      <ComingSoonBadge className="px-3 py-1 text-[11px]" />
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
