"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/app/components/marketing/logo";

export const errorPrimaryBtn =
  "inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]";

export const errorSecondaryBtn =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/60 px-4 py-2 text-sm text-foreground backdrop-blur-xl hover:bg-surface";

type ErrorPageShellProps = {
  eyebrow: string;
  code: string;
  title: string;
  description: ReactNode;
  detail?: string;
  actions: ReactNode;
};

export function ErrorPageShell({
  eyebrow,
  code,
  title,
  description,
  detail,
  actions,
}: ErrorPageShellProps) {
  const [traceId, setTraceId] = useState<string | null>(null);

  useEffect(() => {
    setTraceId(Math.random().toString(36).slice(2, 10));
  }, []);

  return (
    <main
      id="main-content"
      className="relative min-h-screen overflow-hidden bg-background text-foreground"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at 50% 35%, black 0%, black 40%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[520px] w-[520px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--brand) 35%, transparent), transparent)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-6">
        <header className="flex items-center justify-between py-6">
          <Link href="/" aria-label="Telemetry Tracker home">
            <Logo />
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-xl hover:text-foreground"
          >
            Contact support
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur-xl">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-pulse-dot rounded-full bg-destructive" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-destructive" />
              </span>
              <span className="font-mono uppercase tracking-[0.16em]">{eyebrow}</span>
              <span className="text-border-strong">·</span>
              <span className="font-mono">{code}</span>
            </div>

            <h1 className="mt-6 text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
              {title}
            </h1>
            <div className="mt-4 max-w-xl text-base text-muted-foreground">{description}</div>

            <div className="mt-8 flex flex-wrap items-center gap-2">{actions}</div>

            {detail ? (
              <pre className="mt-10 max-w-2xl overflow-x-auto rounded-lg border border-border bg-surface/60 p-4 font-mono text-xs leading-relaxed text-muted-foreground backdrop-blur-xl">
                {detail}
              </pre>
            ) : null}
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-border py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Telemetry Tracker</p>
          <p className="font-mono">incident logged · trace_id {traceId ?? "pending"}</p>
        </footer>
      </div>
    </main>
  );
}

export function ErrorArrowIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export function ErrorRetryIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3" />
    </svg>
  );
}
