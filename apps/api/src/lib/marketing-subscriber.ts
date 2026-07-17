import { randomBytes } from "node:crypto";
import type { MarketingSubscriberSource, Prisma } from "@prisma/client";
import { hashPasswordResetToken } from "./password-reset-token.js";

export const MARKETING_CONSENT_VERSION = "2026.07";

export const SUBSCRIBE_FORM_CONSENT_LABEL =
  "Send me product updates and release notes about Telemetry Tracker.";

export const REGISTRATION_CONSENT_LABEL =
  "Keep me updated about Telemetry Tracker product news and releases.";

export type MarketingConsentMetadata = {
  consentVersion: string;
  consentLabel: string;
  source: MarketingSubscriberSource;
  ip?: string;
  userAgent?: string;
};

export function normalizeMarketingEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Domains Resend (and RFC 2606) reject — keep them out of the marketing list and release sends. */
const RESERVED_MARKETING_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "localhost",
]);

export function isReservedMarketingEmailDomain(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  if (RESERVED_MARKETING_EMAIL_DOMAINS.has(domain)) return true;
  // RFC 2606 / 6761 special-use TLDs
  return /\.(example|invalid|localhost|test)$/i.test(domain);
}

export function isValidMarketingEmail(email: string): boolean {
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    email.length <= 255 &&
    !isReservedMarketingEmailDomain(email)
  );
}

export function hashMarketingUnsubscribeToken(token: string): string {
  return hashPasswordResetToken(token);
}

export function generateMarketingUnsubscribeToken(): string {
  return randomBytes(32).toString("hex");
}

export type SubscribeMarketingInput = {
  email: string;
  source: MarketingSubscriberSource;
  consentLabel: string;
  consentMetadata?: Omit<MarketingConsentMetadata, "consentVersion" | "consentLabel" | "source">;
};

export type SubscribeMarketingResult =
  | { ok: true; created: boolean; reactivated: boolean; unsubscribeToken: string }
  | { ok: false; error: "invalid_email" };

export async function subscribeMarketingEmail(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  input: SubscribeMarketingInput
): Promise<SubscribeMarketingResult> {
  const email = normalizeMarketingEmail(input.email);
  if (!isValidMarketingEmail(email)) {
    return { ok: false, error: "invalid_email" };
  }

  const now = new Date();
  const consentMetadata: MarketingConsentMetadata = {
    consentVersion: MARKETING_CONSENT_VERSION,
    consentLabel: input.consentLabel,
    source: input.source,
    ...input.consentMetadata,
  };
  const rawToken = generateMarketingUnsubscribeToken();
  const tokenHash = hashMarketingUnsubscribeToken(rawToken);

  const existing = await db.marketingSubscriber.findUnique({ where: { email } });
  if (!existing) {
    await db.marketingSubscriber.create({
      data: {
        email,
        source: input.source,
        consent_at: now,
        consent_metadata: consentMetadata,
        unsubscribe_token: tokenHash,
      },
    });
    return { ok: true, created: true, reactivated: false, unsubscribeToken: rawToken };
  }

  if (existing.unsubscribed_at == null) {
    await db.marketingSubscriber.update({
      where: { id: existing.id },
      data: {
        consent_at: now,
        consent_metadata: consentMetadata,
        source: input.source,
      },
    });
    return { ok: true, created: false, reactivated: false, unsubscribeToken: rawToken };
  }

  await db.marketingSubscriber.update({
    where: { id: existing.id },
    data: {
      source: input.source,
      subscribed_at: now,
      unsubscribed_at: null,
      consent_at: now,
      consent_metadata: consentMetadata,
      unsubscribe_token: tokenHash,
    },
  });
  return { ok: true, created: false, reactivated: true, unsubscribeToken: rawToken };
}

export type UnsubscribeMarketingResult =
  | { ok: true; email: string; alreadyUnsubscribed: boolean }
  | { ok: false; error: "invalid_token" };

export async function unsubscribeMarketingByToken(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  token: string
): Promise<UnsubscribeMarketingResult> {
  const trimmed = token.trim();
  if (trimmed.length < 32) {
    return { ok: false, error: "invalid_token" };
  }

  const row = await db.marketingSubscriber.findUnique({
    where: { unsubscribe_token: hashMarketingUnsubscribeToken(trimmed) },
  });
  if (!row) {
    return { ok: false, error: "invalid_token" };
  }
  if (row.unsubscribed_at != null) {
    return { ok: true, email: row.email, alreadyUnsubscribed: true };
  }

  await db.marketingSubscriber.update({
    where: { id: row.id },
    data: { unsubscribed_at: new Date() },
  });
  return { ok: true, email: row.email, alreadyUnsubscribed: false };
}

export function buildMarketingUnsubscribeUrl(baseOrigin: string, token: string): string {
  return `${baseOrigin.replace(/\/$/, "")}/unsubscribe?token=${encodeURIComponent(token)}`;
}
