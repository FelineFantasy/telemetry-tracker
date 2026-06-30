/** Formatted JSON context with scroll and consistent code styling. */
export function JsonContextView({ data, title }: { data: unknown; title: string }) {
  const text =
    data === undefined || data === null
      ? ""
      : typeof data === "string"
        ? data
        : JSON.stringify(data, null, 2);
  if (!text.trim()) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
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
