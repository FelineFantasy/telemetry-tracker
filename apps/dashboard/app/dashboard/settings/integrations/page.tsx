"use client";

import {
  SettingsPageBody,
  SettingsPageHeader,
  SettingsPreviewNote,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import { Section, SettingsBtn, SettingsPill } from "@/app/components/dashboard/settings/settings-ui";

const INTEGRATIONS = [
  { name: "Slack", desc: "Post alerts and error summaries to a channel", connected: false },
  { name: "GitHub", desc: "Link commits and releases to deployments", connected: false },
  { name: "Webhooks", desc: "HTTP callbacks for events and errors", connected: true },
];

export default function IntegrationsSettingsPage() {
  return (
    <>
      <SettingsPageHeader
        title="Integrations"
        description="Connect Telemetry Tracker to your toolchain."
      />
      <SettingsPageBody>
        <SettingsPreviewNote />
        <Section title="Available integrations">
          <ul className="divide-y divide-border">
            {INTEGRATIONS.map((i) => (
              <li key={i.name} className="flex items-center gap-3 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-[11px] font-medium">
                  {i.name.charAt(0)}
                </span>
                <div className="flex-1">
                  <div className="text-[13px]">{i.name}</div>
                  <div className="text-[11px] text-muted-foreground">{i.desc}</div>
                </div>
                {i.connected ? (
                  <>
                    <SettingsPill tone="success">Connected</SettingsPill>
                    <SettingsBtn variant="ghost" size="sm">
                      Configure
                    </SettingsBtn>
                  </>
                ) : (
                  <SettingsBtn variant="default" size="sm">
                    Connect
                  </SettingsBtn>
                )}
              </li>
            ))}
          </ul>
        </Section>
      </SettingsPageBody>
    </>
  );
}
