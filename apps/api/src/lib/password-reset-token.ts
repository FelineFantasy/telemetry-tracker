import { createHash } from "node:crypto";

/** SHA-256 hex digest of the opaque reset token (never store the raw secret). */
export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
