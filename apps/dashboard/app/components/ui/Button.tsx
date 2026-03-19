import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

const base =
  "inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";

export const buttonClass = {
  primary: cn(
    base,
    "border border-white/10 bg-primary text-primary-foreground shadow-sm shadow-inner-soft hover:bg-primary-hover",
  ),
  secondary: cn(
    base,
    "border border-border bg-surface-raised text-foreground shadow-xs hover:bg-muted hover:border-border-subtle",
  ),
  ghost: cn(
    base,
    "border border-transparent bg-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
  ),
  outline: cn(
    base,
    "border border-border bg-transparent text-foreground hover:bg-muted",
  ),
} as const;

export type ButtonVariant = keyof typeof buttonClass;

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button type="button" className={cn(buttonClass[variant], className)} {...props} />;
}

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
};

export function ButtonLink({ variant = "primary", className, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonClass[variant], className)} {...props} />;
}
