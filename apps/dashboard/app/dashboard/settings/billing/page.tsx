"use client";

import Link from "next/link";
import {
  SettingsPageBody,
  SettingsPageHeader,
  SettingsPreviewNote,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import {
  Section,
  SettingsBtn,
  SettingsStat,
  UsageBar,
} from "@/app/components/dashboard/settings/settings-ui";

export default function BillingSettingsPage() {
  return (
    <>
      <SettingsPageHeader
        title="Billing & usage"
        description="Plan, usage, and payment settings for your organization."
        actions={<SettingsBtn variant="primary">Open billing portal</SettingsBtn>}
      />
      <SettingsPageBody>
        <SettingsPreviewNote />
        <Section title="Current plan">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SettingsStat label="Plan" value="Self-hosted" hint="Open source · no cloud billing" />
            <SettingsStat label="Billing status" value="—" hint="Configure Stripe in your API deployment" />
            <SettingsStat label="Seats" value="Unlimited" hint="Members in your organization" />
          </div>
          <p className="mt-4 text-[13px] text-muted-foreground">
            For live Stripe billing and usage limits, manage your organization under{" "}
            <Link href="/dashboard/settings/organization" className="text-brand hover:underline">
              General settings
            </Link>
            .
          </p>
        </Section>
        <Section title="Usage preview">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UsageBar used={1_240_000} total={10_000_000} unit="events" />
            <UsageBar used={12_400} total={100_000} unit="errors" tone="brand" />
          </div>
        </Section>
      </SettingsPageBody>
    </>
  );
}
