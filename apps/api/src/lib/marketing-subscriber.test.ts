import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { MarketingSubscriberSource } from "@prisma/client";
import {
  generateMarketingUnsubscribeToken,
  hashMarketingUnsubscribeToken,
  isReservedMarketingEmailDomain,
  isValidMarketingEmail,
  normalizeMarketingEmail,
  subscribeMarketingEmail,
  unsubscribeMarketingByToken,
} from "./marketing-subscriber.js";
import { prisma } from "./db.js";

describe("marketing-subscriber lib", () => {
  it("normalizes and validates emails", () => {
    expect(normalizeMarketingEmail("  User@Example.COM ")).toBe("user@example.com");
    expect(isValidMarketingEmail("ops@acme.io")).toBe(true);
    expect(isValidMarketingEmail("user@test.com")).toBe(true);
    expect(isValidMarketingEmail("user@notexample.com")).toBe(true);
    expect(isValidMarketingEmail("not-an-email")).toBe(false);
    expect(isValidMarketingEmail("user@example.com")).toBe(false);
    expect(isValidMarketingEmail("user@mail.example.com")).toBe(false);
    expect(isValidMarketingEmail("user@foo.test")).toBe(false);
    expect(isReservedMarketingEmailDomain("diag@example.com")).toBe(true);
    expect(isReservedMarketingEmailDomain("user@mail.example.com")).toBe(true);
    expect(isReservedMarketingEmailDomain("user@a.b.example.org")).toBe(true);
    expect(isReservedMarketingEmailDomain("user@foo.test")).toBe(true);
    expect(isReservedMarketingEmailDomain("ops@acme.io")).toBe(false);
    expect(isReservedMarketingEmailDomain("user@notexample.com")).toBe(false);
  });

  it("hashes unsubscribe tokens deterministically", () => {
    const token = generateMarketingUnsubscribeToken();
    expect(hashMarketingUnsubscribeToken(token)).toHaveLength(64);
    expect(hashMarketingUnsubscribeToken(token)).toBe(hashMarketingUnsubscribeToken(token));
  });
});

const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";

describe.skipIf(!runDbIntegration)("marketing-subscriber (integration)", () => {
  const suffix = randomBytes(6).toString("hex");
  const email = `marketing-${suffix}@test.local`;
  let rawToken = "";

  afterAll(async () => {
    await prisma.marketingSubscriber.deleteMany({ where: { email } }).catch(() => undefined);
  });

  it("subscribe creates a row with consent metadata", async () => {
    const result = await subscribeMarketingEmail(prisma, {
      email,
      source: MarketingSubscriberSource.subscribe_form,
      consentLabel: "Test consent label",
      consentMetadata: { userAgent: "vitest" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    rawToken = result.unsubscribeToken;

    const row = await prisma.marketingSubscriber.findUnique({ where: { email } });
    expect(row?.source).toBe(MarketingSubscriberSource.subscribe_form);
    expect(row?.unsubscribed_at).toBeNull();
    expect(row?.consent_metadata).toMatchObject({
      consentLabel: "Test consent label",
      source: MarketingSubscriberSource.subscribe_form,
    });
  });

  it("unsubscribe marks the subscriber inactive", async () => {
    const result = await unsubscribeMarketingByToken(prisma, rawToken);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyUnsubscribed).toBe(false);

    const row = await prisma.marketingSubscriber.findUnique({ where: { email } });
    expect(row?.unsubscribed_at).not.toBeNull();
  });

  it("reactivates on re-subscribe", async () => {
    const result = await subscribeMarketingEmail(prisma, {
      email,
      source: MarketingSubscriberSource.registration,
      consentLabel: "Registration opt-in",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reactivated).toBe(true);
    rawToken = result.unsubscribeToken;

    const row = await prisma.marketingSubscriber.findUnique({ where: { email } });
    expect(row?.unsubscribed_at).toBeNull();
    expect(row?.source).toBe(MarketingSubscriberSource.registration);
  });
});
