"use client";

import type {
  ButtonHTMLAttributes,
  FormHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { filterInputClassName } from "@/lib/input-classes";

export function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <span className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export function FilterForm({ className, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return <form {...props} className={cn("flex flex-col gap-4", className)} />;
}

export function FilterRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-end gap-3", className)}>{children}</div>;
}

export function FilterField({
  children,
  className,
  grow,
}: {
  children: ReactNode;
  className?: string;
  grow?: boolean;
}) {
  return (
    <label className={cn("flex min-w-[8rem] flex-col gap-1.5", grow && "min-w-[12rem] flex-1", className)}>
      {children}
    </label>
  );
}

export function FilterLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <span id={id} className="text-[12px] text-muted-foreground">
      {children}
    </span>
  );
}

export function FilterInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(filterInputClassName, "w-full", className)}
    />
  );
}

export function FilterSegment({
  legend,
  title,
  ariaLabel,
  children,
}: {
  legend: string;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5 border-0 p-0" title={title}>
      <legend className="text-[12px] text-muted-foreground">{legend}</legend>
      <div
        className="inline-flex divide-x divide-border overflow-hidden rounded-md border border-border"
        role="group"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </fieldset>
  );
}

export function FilterSegmentItem({
  children,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }) {
  return (
    <label className="relative cursor-pointer">
      <input type="radio" className="peer sr-only" {...props} />
      <span className="flex h-9 items-center px-3 text-[13px] text-muted-foreground transition-colors hover:bg-surface/60 peer-checked:bg-brand/15 peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40">
        {children}
      </span>
    </label>
  );
}

export function FilterSubmitWrap({ children }: { children: ReactNode }) {
  return <div className="ml-auto flex items-end">{children}</div>;
}

export function FilterSubmitBtn({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      {...props}
      className={cn(
        "h-9 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground",
        "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  );
}

export function FilterPill({
  active,
  href,
  onClick,
  children,
}: {
  active?: boolean;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className = cn(
    "inline-flex min-h-9 items-center justify-center rounded-md border px-3 text-[13px] font-medium transition-colors",
    active
      ? "border-brand/45 bg-brand/10 text-foreground shadow-[0_0_0_1px_rgba(var(--brand-rgb,103,79,220),0.12)]"
      : "border-border bg-transparent text-muted-foreground hover:border-muted-foreground/30 hover:bg-surface/60 hover:text-foreground"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

export function FilterGhostBtn({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "h-9 rounded-md border border-border bg-transparent px-3 text-[13px] font-medium text-muted-foreground",
        "hover:bg-surface/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        className
      )}
    />
  );
}

export function FilterPopover({
  children,
  style,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-popover p-4 shadow-lg ${className ?? ""}`}
      role="dialog"
      aria-label={ariaLabel}
      style={style}
    >
      {children}
    </div>
  );
}
