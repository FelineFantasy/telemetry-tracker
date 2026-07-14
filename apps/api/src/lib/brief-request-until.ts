import { BRIEF_REQUEST_UNTIL_BUCKET_MS } from "./brief-constants.js";

/**
 * Floor to the start of the current UTC minute.
 *
 * `requestUntil` is the start of the current UTC minute, representing the end of
 * the last completed telemetry bucket. The analyzed window remains half-open
 * `[since, requestUntil)`, so telemetry from the in-progress minute is excluded.
 *
 * Example: at 12:34:15 UTC → requestUntil = 12:34:00 UTC.
 */
export function floorToCompletedMinute(
  now: Date,
  bucketMs: number = BRIEF_REQUEST_UNTIL_BUCKET_MS
): Date {
  const ms = now.getTime();
  const floored = Math.floor(ms / bucketMs) * bucketMs;
  return new Date(floored);
}
