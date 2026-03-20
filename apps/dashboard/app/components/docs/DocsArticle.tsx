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
    <article className="mx-auto max-w-3xl">
      <header className="mb-10 border-b border-border pb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Documentation
        </p>
        <h1>{title}</h1>
        <div className="mt-4 text-base leading-relaxed text-muted-foreground">{lede}</div>
      </header>
      {children}
    </article>
  );
}
