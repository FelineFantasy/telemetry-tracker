export function EmptyState({
  title,
  message,
}: {
  /** Short label (optional), e.g. “Nothing here yet”. */
  title?: string;
  message: string;
}) {
  return (
    <div className="empty-state" role="status">
      {title ? <p className="empty-state__title">{title}</p> : null}
      <p className="empty-state__message">{message}</p>
    </div>
  );
}
