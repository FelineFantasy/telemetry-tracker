import type { ReactNode } from "react";

type DocsArticleProps = {
  title: string;
  /** Lead paragraph(s) below the title — uses muted body styling. */
  lede: ReactNode;
  children: ReactNode;
};

/**
 * Shared layout for all docs pages: max width, “Documentation” kicker, title, lede, then content.
 */
export function DocsArticle({ title, lede, children }: DocsArticleProps) {
  return (
    <article className="min-w-0 max-w-2xl">
      <header className="mb-10 border-b border-border pb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Documentation</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <div className="mt-4 text-base leading-relaxed text-muted-foreground">{lede}</div>
      </header>
      <div className="prose-docs min-w-0 space-y-6 text-[15px] leading-relaxed text-foreground/85 [&_h2]:mt-10 [&_h2]:scroll-mt-36 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_p]:text-foreground/85">
        {children}
      </div>
    </article>
  );
}
