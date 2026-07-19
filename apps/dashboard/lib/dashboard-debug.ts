/** Collapse CR/LF so debug logs cannot be forged via request-derived values. */
function sanitizeForLog(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}

/** Server-side dashboard diagnostics (`DASHBOARD_DEBUG=1` or dev by default). */
export function dashboardDebug(
  scope: string,
  message: string,
  detail?: Record<string, unknown>
): void {
  const enabled =
    process.env.DASHBOARD_DEBUG === "1" ||
    (process.env.NODE_ENV === "development" && process.env.DASHBOARD_DEBUG !== "0");
  if (!enabled) return;
  const safeScope = sanitizeForLog(scope);
  const safeMessage = sanitizeForLog(message);
  const payload = detail
    ? ` ${sanitizeForLog(JSON.stringify(detail))}`
    : "";
  console.log(`[dashboard:${safeScope}] ${safeMessage}${payload}`);
}
