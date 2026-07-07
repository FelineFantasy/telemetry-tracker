/**
 * Event capture taxonomy: SDK auto-captured vs custom event names.
 *
 * Reserved auto-captured names use a `$` prefix (e.g. `$screen`, `$request`).
 */

export const EVENT_CAPTURE_KINDS = ["auto", "custom"] as const;

export type EventCaptureKind = (typeof EVENT_CAPTURE_KINDS)[number];

/** Classify an event name as auto-captured (SDK reserved) or custom. */
export function parseEventCaptureKind(name: string): EventCaptureKind {
  const trimmed = name.trim();
  if (trimmed.startsWith("$")) return "auto";
  return "custom";
}
