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
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  console.log(`[dashboard:${scope}] ${message}${payload}`);
}
