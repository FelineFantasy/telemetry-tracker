/** Readable stack trace: line numbers + monospace, wrapped lines. */
export function StackTraceView({ source, title }: { source: string; title: string }) {
  const lines = source.split(/\r?\n/);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ol className="max-h-96 list-none overflow-auto p-0 font-mono text-[11px] leading-relaxed">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-3 border-b border-border/50 px-3 py-1 last:border-0">
            <span className="w-6 shrink-0 select-none text-right text-muted-foreground" aria-hidden>
              {i + 1}
            </span>
            <code className="min-w-0 flex-1 whitespace-pre-wrap break-all text-foreground/90">
              {line.length ? line : "\u00a0"}
            </code>
          </li>
        ))}
      </ol>
    </div>
  );
}
