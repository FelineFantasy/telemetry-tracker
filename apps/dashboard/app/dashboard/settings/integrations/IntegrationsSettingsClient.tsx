"use client";

import Link from "next/link";
import {
  SettingsPageBody,
  SettingsPageHeader,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import { ComingSoonBadge } from "@/app/components/dashboard/coming-soon-ui";
import { Section, SettingsPill } from "@/app/components/dashboard/settings/settings-ui";
import type { OrganizationIntegration } from "@/lib/organization-integrations";

function scopeLabel(scope: OrganizationIntegration["scope"]): string {
  return scope === "organization" ? "Organization" : "Project";
}

function integrationBtnClass(
  variant: "default" | "ghost",
  size: "sm" | "md" = "sm"
): string {
  const styles: Record<string, string> = {
    default: "bg-surface text-foreground hover:bg-surface-elevated border border-border",
    ghost: "bg-transparent text-muted-foreground hover:text-foreground hover:bg-surface/60 border border-transparent",
  };
  const sizes: Record<string, string> = {
    sm: "h-7 px-2.5 text-[12px]",
    md: "h-8 px-3 text-[13px]",
  };
  return `inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors ${styles[variant]} ${sizes[size]}`;
}

function IntegrationRow({ integration }: { integration: OrganizationIntegration }) {
  const href =
    integration.status === "connected"
      ? integration.configureHref
      : integration.connectHref;
  const actionLabel = integration.status === "connected" ? "Configure" : "Connect";
  const btnVariant = integration.status === "connected" ? "ghost" : "default";

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-[11px] font-medium">
        {integration.name.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px]">{integration.name}</span>
          <span className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
            {scopeLabel(integration.scope)}
          </span>
          {integration.availability === "planned" ? <ComingSoonBadge /> : null}
        </div>
        <div className="text-[11px] text-muted-foreground">{integration.description}</div>
        {integration.trackedIssue ? (
          <div className="mt-1 text-[10px] text-muted-foreground">
            Full setup tracked in issue #{integration.trackedIssue}.
          </div>
        ) : null}
      </div>
      {integration.status === "connected" ? (
        <SettingsPill tone="success">Connected</SettingsPill>
      ) : (
        <SettingsPill tone="muted">Not connected</SettingsPill>
      )}
      <Link href={href} className={integrationBtnClass(btnVariant)}>
        {actionLabel}
      </Link>
    </li>
  );
}

export function IntegrationsSettingsClient({
  organizationId,
  integrations,
}: {
  organizationId: string;
  integrations: OrganizationIntegration[];
}) {
  const connectedCount = integrations.filter((i) => i.status === "connected").length;

  return (
    <>
      <SettingsPageHeader
        title="Integrations"
        description="Connect Telemetry Tracker to your toolchain. Status reflects your organization and projects."
      />
      <SettingsPageBody>
        <Section
          title="Available integrations"
          description={`${connectedCount} of ${integrations.length} connected in this organization.`}
          footer={
            <span>
              Organization ID{" "}
              <span className="font-mono text-foreground">{organizationId}</span>
            </span>
          }
        >
          <ul className="divide-y divide-border">
            {integrations.map((integration) => (
              <IntegrationRow key={integration.id} integration={integration} />
            ))}
          </ul>
        </Section>
      </SettingsPageBody>
    </>
  );
}
