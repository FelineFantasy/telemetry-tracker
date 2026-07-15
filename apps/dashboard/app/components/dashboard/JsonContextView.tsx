"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";

/** Formatted JSON context with scroll and consistent code styling. */
export function JsonContextView({ data, title }: { data: unknown; title: string }) {
  const [copied, setCopied] = useState(false);

  const text =
    data === undefined || data === null
      ? ""
      : typeof data === "string"
        ? data
        : JSON.stringify(data, null, 2);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);

  if (!text.trim()) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <button
          type="button"
          onClick={copy}
          className={cn(
            "shrink-0 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium transition-colors text-muted-foreground hover:text-foreground",
            "hover:bg-muted focus-visible:outline-2 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ring"
          )}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="max-h-96 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-foreground/90"
        tabIndex={0}
      >
        <code>{text}</code>
      </pre>
    </div>
  );
}
