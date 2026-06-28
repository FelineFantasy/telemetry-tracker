import Link from "next/link";
import type { ReactNode } from "react";

export function LegalExternalLink({
  href,
  children,
  sameTab = false,
}: {
  href: string;
  children: ReactNode;
  /** Keep in-app navigation in the current tab (e.g. forgot password from a modal). */
  sameTab?: boolean;
}) {
  const className = "font-medium text-brand underline-offset-2 hover:underline";
  const isExternal =
    href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:");

  if (sameTab && !isExternal) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

export function LegalArticle({
  title,
  updated,
  children,
  eyebrow = "Legal",
}: {
  title: string;
  updated?: string;
  children: ReactNode;
  eyebrow?: string;
}) {
  return (
    <article className="min-w-0 pb-24">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      {updated ? (
        <p className="mt-4 text-sm text-muted-foreground">Last updated {updated}</p>
      ) : null}
      <div className={updated ? "mt-10" : "mt-6"}>{children}</div>
    </article>
  );
}

export function LegalSection({
  id,
  title,
  children,
  first = false,
}: {
  id: string;
  title: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-32 ${first ? "mt-0" : "mt-16 border-t border-border pt-10"}`}
    >
      <h2 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h2>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-foreground/85 [&_li]:text-foreground/85 [&_p]:max-w-2xl [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
