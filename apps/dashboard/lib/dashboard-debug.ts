/** Strip CR/LF before logging (CodeQL js/log-injection: replace /\n|\r/g with ""). */
function sanitizeForLog(value: string): string {
  return value.replace(/\n|\r/g, "");
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
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  console.log(`[dashboard:${safeScope}] ${safeMessage}${payload}`);
}
