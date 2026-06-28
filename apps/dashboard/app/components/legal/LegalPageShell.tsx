import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/app/components/marketing/logo";

export function LegalExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-brand underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

export function LegalPageShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main id="main-content" className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-surface/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-6">
          <Link href="/">
            <Logo />
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Legal</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {children}
        </div>
      </article>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-medium tracking-tight text-foreground">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
