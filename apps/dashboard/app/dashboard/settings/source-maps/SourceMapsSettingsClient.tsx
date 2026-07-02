"use client";

import { useCallback, useState } from "react";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { Field } from "@/app/components/dashboard/settings/settings-ui";

type ArtifactRow = {
  id: string;
  app: string;
  release: string;
  bundleUrl: string;
  sha256: string;
  sizeBytes: number;
  uploadedAt: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function SourceMapsSettingsClient({
  initialApp,
  initialRelease,
}: {
  initialApp: string;
  initialRelease: string;
}) {
  const [app, setApp] = useState(initialApp);
  const [release, setRelease] = useState(initialRelease);
  const [artifacts, setArtifacts] = useState<ArtifactRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const appLabel = app.trim();
    const releaseLabel = release.trim();
    if (!appLabel || !releaseLabel) {
      setError("Enter both app and release to list uploaded maps.");
      setArtifacts(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ app: appLabel, release: releaseLabel });
      const res = await fetch(`/api/project/source-maps?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { artifacts?: ArtifactRow[] };
      setArtifacts(data.artifacts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setArtifacts(null);
    } finally {
      setLoading(false);
    }
  }, [app, release]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Source maps are keyed by app, release, and bundle URL. Upload via{" "}
        <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">
          POST /api/project/source-maps
        </code>{" "}
        (EDITOR+ session). See{" "}
        <a
          href="https://github.com/Telemetry-Tracker/telemetry-tracker/blob/develop/docs/source-maps.md"
          className="text-brand hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          docs/source-maps.md
        </a>{" "}
        for CI examples.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="App">
          <input
            id="source-maps-app"
            aria-label="App"
            value={app}
            onChange={(e) => setApp(e.target.value)}
            placeholder="web"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Release">
          <input
            id="source-maps-release"
            aria-label="Release"
            value={release}
            onChange={(e) => setRelease(e.target.value)}
            placeholder="1.0.0"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <button
        type="button"
        onClick={() => void load()}
        disabled={loading}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Loading…" : "List maps"}
      </button>

      {error ? <ErrorState message={error} /> : null}

      {artifacts !== null && artifacts.length === 0 ? (
        <EmptyState
          title="No maps for this release"
          message="Upload source maps for this app and release to enable symbolicated stack traces on error detail."
        />
      ) : null}

      {artifacts && artifacts.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-surface/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Bundle</th>
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium">SHA-256</th>
                <th className="px-4 py-2 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.map((row) => (
                <tr key={row.id} className="border-b border-border/50 last:border-0">
                  <td className="max-w-xs truncate px-4 py-2 font-mono text-xs" title={row.bundleUrl}>
                    {row.bundleUrl}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{formatBytes(row.sizeBytes)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {row.sha256.slice(0, 12)}…
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(row.uploadedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
