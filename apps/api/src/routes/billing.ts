import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import Stripe from "stripe";
import { PlanTier } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { requireSessionUser } from "../lib/auth-session.js";
import {
  canManageMembers,
  getMembershipRoleForOrganization,
} from "../lib/org-permissions.js";
import { dashboardOriginOrNull } from "../lib/dashboard-origin.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

function priceIdForTier(tier: "PRO" | "BUSINESS"): string | null {
  if (tier === "PRO") {
    return process.env.STRIPE_PRICE_PRO?.trim() ?? null;
  }
  return process.env.STRIPE_PRICE_BUSINESS?.trim() ?? null;
}

function parseUpgradeTier(raw: unknown): "PRO" | "BUSINESS" | null {
  if (raw === "PRO" || raw === PlanTier.PRO) return "PRO";
  if (raw === "BUSINESS" || raw === PlanTier.BUSINESS) return "BUSINESS";
  return null;
}

/**
 * Stripe Checkout + Billing Portal for organization owners.
 * Requires STRIPE_SECRET_KEY and price ids STRIPE_PRICE_PRO / STRIPE_PRICE_BUSINESS.
 */
export async function billingRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  app.post<{ Params: { orgId: string } }>(
    "/meta/organizations/:orgId/billing/checkout",
    async (request, reply) => {
      const stripe = stripeClient();
      if (!stripe) {
        return reply.status(503).send({ error: "Stripe is not configured" });
      }
      const session = await requireSessionUser(request, reply);
      if (!session) return;
      const orgId = request.params.orgId.trim();
      if (!UUID_RE.test(orgId)) {
        return reply.status(400).send({ error: "Invalid organization id" });
      }
      const role = await getMembershipRoleForOrganization(session.userId, orgId);
      if (!canManageMembers(role)) {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const body = (request.body ?? {}) as { planTier?: string };
      const tier = parseUpgradeTier(body.planTier);
      if (!tier) {
        return reply.status(400).send({ error: "planTier must be PRO or BUSINESS" });
      }
      const priceId = priceIdForTier(tier);
      if (!priceId) {
        return reply.status(503).send({ error: "Stripe price not configured for this tier" });
      }

      const org = await prisma.organization.findFirst({
        where: { id: orgId, deleted_at: null },
        select: {
          id: true,
          name: true,
          stripe_customer_id: true,
        },
      });
      if (!org) {
        return reply.status(404).send({ error: "Organization not found" });
      }

      let customerId = org.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          name: org.name,
          metadata: { organization_id: orgId },
        });
        customerId = customer.id;
        await prisma.organization.update({
          where: { id: orgId },
          data: { stripe_customer_id: customerId },
        });
      }

      const origin = dashboardOriginOrNull();
      if (!origin) {
        return reply.status(503).send({ error: "Dashboard origin is not configured" });
      }
      const checkout = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/dashboard/settings/organization?billing=success`,
        cancel_url: `${origin}/dashboard/settings/organization?billing=canceled`,
        metadata: {
          organization_id: orgId,
          plan_tier: tier,
        },
        subscription_data: {
          metadata: {
            organization_id: orgId,
            plan_tier: tier,
          },
        },
      });

      if (!checkout.url) {
        return reply.status(500).send({ error: "Could not create checkout session" });
      }
      return reply.send({ url: checkout.url });
    }
  );

  app.post<{ Params: { orgId: string } }>(
    "/meta/organizations/:orgId/billing/portal",
    async (request, reply) => {
      const stripe = stripeClient();
      if (!stripe) {
        return reply.status(503).send({ error: "Stripe is not configured" });
      }
      const session = await requireSessionUser(request, reply);
      if (!session) return;
      const orgId = request.params.orgId.trim();
      if (!UUID_RE.test(orgId)) {
        return reply.status(400).send({ error: "Invalid organization id" });
      }
      const role = await getMembershipRoleForOrganization(session.userId, orgId);
      if (!canManageMembers(role)) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const org = await prisma.organization.findFirst({
        where: { id: orgId, deleted_at: null },
        select: { stripe_customer_id: true },
      });
      if (!org?.stripe_customer_id) {
        return reply.status(400).send({ error: "No Stripe customer for this organization" });
      }

      const origin = dashboardOriginOrNull();
      if (!origin) {
        return reply.status(503).send({ error: "Dashboard origin is not configured" });
      }
      const portal = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: `${origin}/dashboard/settings/organization`,
      });
      return reply.send({ url: portal.url });
    }
  );
}
