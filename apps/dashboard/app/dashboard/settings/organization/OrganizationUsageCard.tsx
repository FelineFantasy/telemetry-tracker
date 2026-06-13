"use client";

import type { UsageQuotaInfo } from "@/lib/dashboard-capabilities";
import { OrganizationBillingActions } from "./OrganizationBillingActions";

export function OrganizationUsageCard({
  usage,
  organizationId,
  canManageBilling,
  hasStripeCustomer,
}: {
  usage: UsageQuotaInfo;
  organizationId?: string;
  canManageBilling?: boolean;
  hasStripeCustomer?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, usage.percentUsed));
  const barClass =
    usage.quotaExceeded || usage.nearQuota
      ? "h-2 rounded-full bg-destructive"
      : "h-2 rounded-full bg-primary";

  return (
    <section className="card mb-6 max-w-md p-6" aria-labelledby="usage-heading">
      <h2 id="usage-heading" className="card__label mb-3">
        Usage &amp; plan
      </h2>
      <p className="m-0 mb-1 text-sm text-muted-foreground">
        Plan: <strong className="text-foreground">{usage.planTier}</strong>
        {usage.retentionDays != null ? (
          <>
            {" "}
            · Retention: <strong className="text-foreground">{usage.retentionDays} days</strong>
          </>
        ) : null}
      </p>
      <p className="m-0 mb-3 text-sm text-foreground">
        {usage.monthlyIngestUsed.toLocaleString()} / {usage.monthlyIngestLimit.toLocaleString()}{" "}
        ingest units this month ({usage.percentUsed}%)
      </p>
      <div
        className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Monthly ingest usage"
      >
        <div className={barClass} style={{ width: `${pct}%` }} />
      </div>
      {usage.quotaExceeded ? (
        <p className="m-0 text-sm text-destructive" role="status">
          Monthly limit reached — new ingest is rejected until usage drops or you upgrade.
        </p>
      ) : usage.nearQuota ? (
        <p className="m-0 text-sm text-warning" role="status">
          Usage is high (≥90% of your plan limit).
        </p>
      ) : null}
      {organizationId && canManageBilling ? (
        <OrganizationBillingActions
          organizationId={organizationId}
          canManageBilling={canManageBilling}
          hasStripeCustomer={hasStripeCustomer === true}
        />
      ) : null}
    </section>
  );
}
