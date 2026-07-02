"use client";

import { useState } from "react";
import { StackTraceView } from "@/app/components/dashboard/StackTraceView";

type StackMode = "symbolicated" | "raw";

export type SymbolicationStatus = "symbolicated" | "no_maps" | "no_match";

function sourceMapsSettingsHref(app?: string | null, release?: string | null): string {
  const params = new URLSearchParams();
  if (app?.trim()) params.set("app", app.trim());
  if (release?.trim()) params.set("release", release.trim());
  const query = params.toString();
  return query ? `/dashboard/settings/source-maps?${query}` : "/dashboard/settings/source-maps";
}

export function StackTracePanel({
  raw,
  symbolicated,
  title = "Stack trace",
  release,
  app,
  symbolicationStatus,
}: {
  raw: string;
  symbolicated?: string | null;
  title?: string;
  release?: string | null;
  app?: string | null;
  symbolicationStatus?: SymbolicationStatus | null;
}) {
  const hasSymbolicated = Boolean(symbolicated?.trim());
  const [mode, setMode] = useState<StackMode>(hasSymbolicated ? "symbolicated" : "raw");
  const activeMode = hasSymbolicated ? mode : "raw";
  const source = activeMode === "symbolicated" && symbolicated ? symbolicated : raw;
  const settingsHref = sourceMapsSettingsHref(app, release);

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
      {!hasSymbolicated && symbolicationStatus === "no_maps" && release?.trim() ? (
        <p className="text-xs text-muted-foreground">
          No source maps uploaded for release <span className="font-mono">{release}</span>. Upload
          maps in{" "}
          <a href={settingsHref} className="text-brand hover:underline">
            Settings → Source maps
          </a>{" "}
          or via the upload API.
        </p>
      ) : null}
      {!hasSymbolicated && symbolicationStatus === "no_match" && release?.trim() ? (
        <p className="text-xs text-muted-foreground">
          Source maps exist for release <span className="font-mono">{release}</span>, but no stack
          frame matched an uploaded <span className="font-mono">bundle_url</span>. Confirm the map
          key matches the minified file URL in{" "}
          <a href={settingsHref} className="text-brand hover:underline">
            Settings → Source maps
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
