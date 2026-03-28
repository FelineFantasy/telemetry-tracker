"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";

type CodeBlockProps = {
  code: string;
  lang?: string;
  /** Short label in the toolbar (e.g. “Quick start”). */
  caption?: string;
};

export function CodeBlock({ code, lang, caption }: CodeBlockProps) {
  const trimmed = code.trim();
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [trimmed]);

  return (
    <figure className="docs-code-block not-prose my-6 overflow-hidden rounded-lg border border-code-border bg-code-bg shadow-sm">
      <div className="flex min-h-[2.5rem] flex-wrap items-center justify-between gap-2 border-b border-code-border/80 bg-black/15 px-3 py-2">
        <figcaption className="text-xs font-medium text-code-foreground/80">
          {caption ?? "Code"}
        </figcaption>
        <button
          type="button"
          onClick={copy}
          className={cn(
            "shrink-0 rounded-md border border-code-border px-2.5 py-1 text-xs font-medium text-code-foreground transition-colors",
            "hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          )}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="m-0 max-h-[min(70vh,28rem)] overflow-x-auto overflow-y-auto p-4 text-sm leading-relaxed">
        <code className={cn("font-mono text-code-foreground", lang ? `language-${lang}` : undefined)}>
          {trimmed}
        </code>
      </pre>
    </figure>
  );
}
