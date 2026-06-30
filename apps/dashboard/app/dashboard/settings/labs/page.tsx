"use client";

import {
  SettingsPageBody,
  SettingsPageHeader,
  SettingsPreviewNote,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import { Section, SettingsPill, SettingsToggle } from "@/app/components/dashboard/settings/settings-ui";

const FLAGS = [
  { id: "cmdk", label: "Command palette", desc: "Global ⌘K navigation (preview)", on: false },
  { id: "traces", label: "Traces view", desc: "Distributed tracing UI", on: false },
  { id: "alerts", label: "Alert rules", desc: "Threshold-based alerting", on: false },
];

export default function LabsSettingsPage() {
  return (
    <>
      <SettingsPageHeader
        title="Labs"
        description="Experimental features — may change or be removed."
      />
      <SettingsPageBody>
        <SettingsPreviewNote />
        <Section title="Feature previews">
          <ul className="divide-y divide-border">
            {FLAGS.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-[13px]">
                    {f.label}
                    <SettingsPill tone="brand">Preview</SettingsPill>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{f.desc}</div>
                </div>
                <SettingsToggle on={f.on} onChange={() => {}} />
              </li>
            ))}
          </ul>
        </Section>
      </SettingsPageBody>
    </>
  );
}
