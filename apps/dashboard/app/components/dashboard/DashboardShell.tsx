"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DashboardCapabilitiesProvider } from "./DashboardCapabilitiesContext";
import { DashboardCapabilitiesSetterContext } from "./shell/DashboardCapabilitiesSetterContext";
import { DashboardKeyboardShortcuts } from "./shell/DashboardKeyboardShortcuts";
import type { DashboardSessionContext } from "@/lib/dashboard-capabilities";

const BILLING_TOAST_SESSION_KEY = "tt_dashboard_billing_toast_v1";

function formatPeriodEnd(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return null;
  }
}

export function DashboardShell({
  children,
  capabilitiesLoader,
}: {
  children: React.ReactNode;
  capabilitiesLoader: React.ReactNode;
}) {
  const [capabilities, setCapabilities] = useState<DashboardSessionContext | null>(null);
  const billingToastShownRef = useRef(false);

  useEffect(() => {
    if (!capabilities || billingToastShownRef.current) return;
    try {
      if (sessionStorage.getItem(BILLING_TOAST_SESSION_KEY) === "1") {
        billingToastShownRef.current = true;
        return;
      }
      sessionStorage.setItem(BILLING_TOAST_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    billingToastShownRef.current = true;
    toast.message("Stripe billing", {
      id: "dashboard-billing-info",
      description:
        "Plan tier syncs from Stripe after checkout or when a subscription changes. Past-due, unpaid, or canceled subscriptions also show a banner here.",
      duration: 12_000,
    });
  }, [capabilities]);

  return (
    <DashboardCapabilitiesSetterContext.Provider value={setCapabilities}>
      <DashboardKeyboardShortcuts />
      <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-8 sm:px-6 lg:px-8" id="main-content">
        {capabilitiesLoader}
        <DashboardCapabilitiesProvider value={capabilities}>
          {capabilities?.billingHealth?.billingAlertVariant ? (
            <BillingAlert capabilities={capabilities} />
          ) : null}
          {capabilities?.usageQuota?.nearQuota ? (
            <QuotaBanner capabilities={capabilities} />
          ) : null}
          {children}
        </DashboardCapabilitiesProvider>
      </main>
    </DashboardCapabilitiesSetterContext.Provider>
  );
}

function BillingAlert({ capabilities }: { capabilities: DashboardSessionContext }) {
  const v = capabilities.billingHealth?.billingAlertVariant;
  const tier = capabilities.billingHealth?.storedPlanTier;
  const effective = capabilities.billingHealth?.effectivePlanTier;
  const end = formatPeriodEnd(capabilities.billingHealth?.stripeCurrentPeriodEnd ?? null);

  return (
    <div
      className={
        v === "past_due"
          ? "mb-4 rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-foreground"
          : "mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground"
      }
      role="alert"
    >
      {v === "past_due" ? (
        <>
          <strong>Payment past due.</strong> Update your payment method via Stripe. Your{" "}
          <strong>{tier}</strong> limits still apply until the subscription updates.
        </>
      ) : v === "unpaid" ? (
        <>
          <strong>Subscription unpaid.</strong> Effective tier: <strong>{effective}</strong>.
        </>
      ) : v === "incomplete" ? (
        <>
          <strong>Subscription incomplete.</strong> Entitlements use the{" "}
          <strong>{effective}</strong> tier until payment completes.
        </>
      ) : v === "incomplete_expired" ? (
        <>
          <strong>Subscription setup expired.</strong> Entitlements use the{" "}
          <strong>{effective}</strong> tier until you subscribe again.
        </>
      ) : (
        <>
          <strong>Subscription canceled.</strong> Entitlements follow the{" "}
          <strong>{effective}</strong> tier.
        </>
      )}
      {end ? (
        <>
          {" "}
          Current period end: <strong>{end}</strong>.
        </>
      ) : null}
    </div>
  );
}

function QuotaBanner({ capabilities }: { capabilities: DashboardSessionContext }) {
  const q = capabilities.usageQuota!;
  return (
    <div
      className={
        q.quotaExceeded
          ? "mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
          : "mb-4 rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm"
      }
      role="status"
    >
      {q.quotaExceeded ? (
        <>
          Monthly ingest is at or above your <strong>{q.planTier}</strong> plan limit (
          {q.monthlyIngestUsed.toLocaleString()} / {q.monthlyIngestLimit.toLocaleString()} units,{" "}
          <strong>{q.percentUsed}%</strong>). New ingest is being rejected.
        </>
      ) : (
        <>
          Monthly ingest usage is high: <strong>{q.percentUsed}%</strong> of your{" "}
          <strong>{q.planTier}</strong> plan limit.
        </>
      )}
    </div>
  );
}
