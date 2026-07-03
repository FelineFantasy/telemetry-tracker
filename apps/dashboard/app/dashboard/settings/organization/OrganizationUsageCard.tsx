"use client";

import type { UsageQuotaInfo } from "@/lib/dashboard-capabilities";
import { Section, UsageBar } from "@/app/components/dashboard/settings/settings-ui";
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
  const tone = usage.quotaExceeded ? "danger" : usage.nearQuota ? "warning" : "brand";

  return (
    <Section title="Usage & plan">
      <p className="mb-4 text-[13px] text-muted-foreground">
        Plan: <strong className="text-foreground">{usage.planTier}</strong>
        {usage.retentionDays != null ? (
          <>
            {" "}
            · Retention: <strong className="text-foreground">{usage.retentionDays} days</strong>
          </>
        ) : null}
      </p>
      <UsageBar
        used={usage.monthlyIngestUsed}
        total={usage.monthlyIngestLimit}
        unit="ingest units"
        tone={tone}
      />
      {usage.quotaExceeded ? (
        <p className="mt-3 text-sm text-destructive" role="status">
          Monthly limit reached — new ingest is rejected until usage drops or you upgrade.
        </p>
      ) : usage.nearQuota ? (
        <p className="mt-3 text-sm text-warning" role="status">
          Usage is high (≥90% of your plan limit).
        </p>
      ) : null}
      {organizationId && canManageBilling ? (
        <div className="mt-4">
          <OrganizationBillingActions
            organizationId={organizationId}
            canManageBilling={canManageBilling}
            hasStripeCustomer={hasStripeCustomer === true}
            planTier={usage.planTier}
          />
        </div>
      ) : null}
    </Section>
  );
}
