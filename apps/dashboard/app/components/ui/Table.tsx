import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

const tableClass = cn(
  "min-w-full text-[13px]",
  "[&_thead_tr]:border-b [&_thead_tr]:border-border",
  "[&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground",
  "[&_tbody_tr]:border-b [&_tbody_tr]:border-border last:[&_tbody_tr]:border-0",
  "[&_tbody_tr:hover]:bg-surface/40",
  "[&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top"
);

export function TableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-surface/40", className)}>
      {children}
    </div>
  );
}

export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <table className={cn(tableClass, className)}>{children}</table>;
}

export type TableListLinkProps = ComponentPropsWithoutRef<typeof Link>;

export function TableListLink({ className, ...props }: TableListLinkProps) {
  return (
    <Link
      {...props}
      className={cn(
        "block max-w-[12rem] break-all font-medium text-foreground underline-offset-4 hover:text-brand hover:underline sm:max-w-none",
        className
      )}
    />
  );
}

export function TablePropertiesCell({ data }: { data: unknown }) {
  if (data == null || typeof data !== "object" || Object.keys(data as object).length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <pre className="max-h-24 max-w-full overflow-auto break-all rounded-md border border-border bg-background/80 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground sm:max-w-md">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

/** Apply to date/time column headers and cells to prevent word-by-word wrapping. */
export const tableDateColumnClass = "whitespace-nowrap";

export function TableViewLink({
  href,
  children = "View",
}: {
  href: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-[13px] text-muted-foreground underline-offset-4 hover:text-brand hover:underline"
    >
      {children}
    </Link>
  );
}
