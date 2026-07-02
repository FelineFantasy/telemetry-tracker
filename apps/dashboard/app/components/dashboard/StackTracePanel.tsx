"use client";

import { useState } from "react";
import { StackTraceView } from "@/app/components/dashboard/StackTraceView";

type StackMode = "symbolicated" | "raw";

export function StackTracePanel({
  raw,
  symbolicated,
  title = "Stack trace",
  release,
}: {
  raw: string;
  symbolicated?: string | null;
  title?: string;
  release?: string | null;
}) {
  const hasSymbolicated = Boolean(symbolicated?.trim());
  const [mode, setMode] = useState<StackMode>(hasSymbolicated ? "symbolicated" : "raw");
  const activeMode = hasSymbolicated ? mode : "raw";
  const source = activeMode === "symbolicated" && symbolicated ? symbolicated : raw;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hasSymbolicated ? (
          <nav
            className="inline-flex rounded-md border border-border bg-surface/60 p-0.5"
            aria-label="Stack trace view"
          >
            <button
              type="button"
              onClick={() => setMode("symbolicated")}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                activeMode === "symbolicated"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Symbolicated
            </button>
            <button
              type="button"
              onClick={() => setMode("raw")}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                activeMode === "raw"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Raw
            </button>
          </nav>
        ) : null}
      </div>
      <StackTraceView
        source={source}
        title={hasSymbolicated && activeMode === "symbolicated" ? `${title} (symbolicated)` : title}
      />
      {!hasSymbolicated && release?.trim() ? (
        <p className="text-xs text-muted-foreground">
          No source map found for release <span className="font-mono">{release}</span>. Upload maps in{" "}
          <a href="/dashboard/settings/source-maps" className="text-brand hover:underline">
            Settings → Source maps
          </a>{" "}
          or via the upload API.
        </p>
      ) : null}
    </div>
  );
}
