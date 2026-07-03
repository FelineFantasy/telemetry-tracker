import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { MarketingSubscriberSource } from "@prisma/client";
import { prisma } from "../lib/db.js";
import {
  isValidMarketingEmail,
  normalizeMarketingEmail,
  SUBSCRIBE_FORM_CONSENT_LABEL,
  subscribeMarketingEmail,
  unsubscribeMarketingByToken,
} from "../lib/marketing-subscriber.js";

function requestConsentMetadata(request: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}) {
  const userAgent = request.headers["user-agent"];
  return {
    ip: request.ip,
    userAgent: typeof userAgent === "string" ? userAgent.slice(0, 512) : undefined,
  };
}

export async function marketingRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.post("/marketing/subscribe", async (request, reply) => {
    const body = (request.body ?? {}) as { email?: string };
    const email = typeof body.email === "string" ? normalizeMarketingEmail(body.email) : "";

    if (!email || !isValidMarketingEmail(email)) {
      return reply.status(400).send({ error: "Enter a valid email address" });
    }

    const result = await subscribeMarketingEmail(prisma, {
      email,
      source: MarketingSubscriberSource.subscribe_form,
      consentLabel: SUBSCRIBE_FORM_CONSENT_LABEL,
      consentMetadata: requestConsentMetadata(request),
    });

    if (!result.ok) {
      return reply.status(400).send({ error: "Enter a valid email address" });
    }

    return reply.send({
      ok: true,
      message: "You're subscribed to product updates.",
      created: result.created,
      reactivated: result.reactivated,
    });
  });

  app.post("/marketing/unsubscribe", async (request, reply) => {
    const body = (request.body ?? {}) as { token?: string };
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (!token) {
      return reply.status(400).send({ error: "Missing unsubscribe token" });
    }

    const result = await unsubscribeMarketingByToken(prisma, token);
    if (!result.ok) {
      return reply.status(400).send({ error: "Invalid or expired unsubscribe link" });
    }

    return reply.send({
      ok: true,
      alreadyUnsubscribed: result.alreadyUnsubscribed,
      message: result.alreadyUnsubscribed
        ? "You were already unsubscribed from product updates."
        : "You have been unsubscribed from product updates.",
    });
  });
}
