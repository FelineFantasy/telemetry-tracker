import { currentYearMonth } from "./usage-meter.js";

/** Scoped dedupe/read key for quota alerts — one near/exceeded per project per month. */
export function quotaNotificationKey(
  projectId: string,
  kind: "near" | "exceeded",
  yearMonth: string = currentYearMonth()
): string {
  return `quota:${kind}:${projectId}:${yearMonth}`;
}
