"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/app/components/BrandLogo";

type ErrorPageShellProps = {
  /** Short code shown in mono, e.g. HTTP 404 */
  code: string;
  eyebrow: string;
  title: string;
  description: ReactNode;
  /** Logo size in px (square). */
  logoSize?: number;
  footer?: ReactNode;
  children: ReactNode;
};

export function ErrorPageShell({
  code,
  eyebrow,
  title,
  description,
  logoSize = 80,
  footer,
  children,
}: ErrorPageShellProps) {
  return (
    <div className="error-page flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div className="error-page-enter relative z-10 flex w-full max-w-lg flex-col items-center text-center">
        <div className="error-page-logo drop-shadow-[0_8px_32px_rgba(103,79,220,0.2)]">
          <BrandLogo size={logoSize} priority />
        </div>
        <p className="mt-8 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {code}
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
        <h1 className="mt-4 text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <div className="mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">{children}</div>
        {footer ? <div className="mt-10 w-full max-w-lg">{footer}</div> : null}
      </div>
    </div>
  );
}
