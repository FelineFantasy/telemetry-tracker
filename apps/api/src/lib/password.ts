import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_LEN = 16;
const KEY_LEN = 64;

/** Format: `<saltHex>:<hashHex>` */
export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(plain, salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const i = stored.indexOf(":");
  if (i <= 0) return false;
  const saltHex = stored.slice(0, i);
  const hashHex = stored.slice(i + 1);
  try {
    const salt = Buffer.from(saltHex, "hex");
    const hash = Buffer.from(hashHex, "hex");
    const test = scryptSync(plain, salt, hash.length);
    return hash.length === test.length && timingSafeEqual(hash, test);
  } catch {
    return false;
  }
}
