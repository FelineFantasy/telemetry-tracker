/**
 * Error type taxonomy from message prefix (TypeError:, ReferenceError:, etc.).
 */

import { Prisma } from "@prisma/client";

export const ERROR_TYPES = [
  "TypeError",
  "ReferenceError",
  "Network Error",
  "Validation Error",
  "Other",
] as const;

export type ErrorType = (typeof ERROR_TYPES)[number];

/** Parse error type from a grouped error message. */
export function parseErrorTypeFromMessage(message: string): ErrorType {
  const trimmed = message.trim();
  if (/^TypeError:/i.test(trimmed)) return "TypeError";
  if (/^ReferenceError:/i.test(trimmed)) return "ReferenceError";
  if (/^Network Error/i.test(trimmed)) return "Network Error";
  if (/^Validation Error/i.test(trimmed)) return "Validation Error";
  return "Other";
}

/** SQL CASE expression classifying `ErrorGroup.message` (must match parseErrorTypeFromMessage). */
export function errorTypeSqlExpression(egAlias = "eg"): Prisma.Sql {
  const msg = Prisma.raw(`TRIM("${egAlias}"."message")`);
  return Prisma.sql`CASE
    WHEN ${msg} ILIKE 'TypeError:%' THEN 'TypeError'
    WHEN ${msg} ILIKE 'ReferenceError:%' THEN 'ReferenceError'
    WHEN ${msg} ILIKE 'Network Error%' THEN 'Network Error'
    WHEN ${msg} ILIKE 'Validation Error%' THEN 'Validation Error'
    ELSE 'Other'
  END`;
}
