"use client";

import {
  SettingsPageBody,
  SettingsPageHeader,
  SettingsComingSoonNote,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import { Section, SettingsBtn, SettingsPill } from "@/app/components/dashboard/settings/settings-ui";

const THEMES = [
  { id: "dark", label: "Dark", desc: "Pure black canvas — default", active: true },
  { id: "light", label: "Light", desc: "Coming soon", active: false },
  { id: "system", label: "System", desc: "Coming soon", active: false },
];

export default function AppearanceSettingsPage() {
  return (
    <>
      <SettingsPageHeader
        title="Appearance"
        description="Visual preferences for the dashboard."
        actions={<SettingsBtn variant="primary">Save changes</SettingsBtn>}
      />
      <SettingsPageBody>
        <SettingsComingSoonNote />
        <Section title="Theme">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={!t.active}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  t.active
                    ? "border-brand bg-brand-soft/30"
                    : "border-border bg-surface/40 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium">{t.label}</span>
                  {t.active ? <SettingsPill tone="brand">Active</SettingsPill> : null}
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Density">
          <p className="text-[13px] text-muted-foreground">
            Telemetry Tracker is optimized for the dark theme today. Additional themes will ship in a
            future release.
          </p>
        </Section>
      </SettingsPageBody>
    </>
  );
}
