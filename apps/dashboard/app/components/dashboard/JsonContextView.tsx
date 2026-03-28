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
    <div className="json-context-block">
      <div className="json-context-block__head">{title}</div>
      <pre className="json-context-block__pre" tabIndex={0}>
        <code>{text}</code>
      </pre>
    </div>
  );
}
