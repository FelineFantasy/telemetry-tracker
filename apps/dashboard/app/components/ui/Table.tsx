import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export function TableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("table-wrap", className)}>{children}</div>;
}

export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <table className={cn("table", className)}>{children}</table>;
}

export type TableListLinkProps = ComponentPropsWithoutRef<typeof Link>;

/** Primary cell link style for dashboard tables (see `.list-link` in globals.css). */
export function TableListLink({ className, ...props }: TableListLinkProps) {
  return <Link {...props} className={cn("list-link", className)} />;
}
