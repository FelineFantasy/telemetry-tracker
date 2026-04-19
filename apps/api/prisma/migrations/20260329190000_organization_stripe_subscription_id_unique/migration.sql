-- Index-backed lookup for Stripe webhooks (`customer.subscription.deleted`); enforces at most one org per subscription id.
CREATE UNIQUE INDEX "Organization_stripe_subscription_id_key" ON "Organization"("stripe_subscription_id");
