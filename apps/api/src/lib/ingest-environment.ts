/**
 * Trim + cap environment so Event / Session / ErrorOccurrence values match
 * AlertRule `environment` filters (zod `.trim().max(64)` on conditions).
 */
export function normalizeIngestEnvironment(
  environment: string | null | undefined
): string | null {
  if (environment == null) return null;
  const trimmed = environment.trim().slice(0, 64);
  return trimmed === "" ? null : trimmed;
}
