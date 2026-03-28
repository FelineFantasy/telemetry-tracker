/** Readable stack trace: line numbers + monospace, wrapped lines. */
export function StackTraceView({ source, title }: { source: string; title: string }) {
  const lines = source.split(/\r?\n/);
  return (
    <div className="stack-trace-block">
      <div className="stack-trace-block__head">{title}</div>
      <ol className="stack-trace-block__lines">
        {lines.map((line, i) => (
          <li key={i} className="stack-trace-block__line">
            <span className="stack-trace-block__num" aria-hidden>
              {i + 1}
            </span>
            <code className="stack-trace-block__code">{line.length ? line : "\u00a0"}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}
