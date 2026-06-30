"use client";

import {
  SettingsPageBody,
  SettingsPageHeader,
  SettingsPreviewNote,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import {
  Field,
  FieldGroup,
  Section,
  SettingsBtn,
  SettingsSelect,
  SettingsToggle,
} from "@/app/components/dashboard/settings/settings-ui";

export default function PreferencesSettingsPage() {
  return (
    <>
      <SettingsPageHeader
        title="Preferences"
        description="Defaults for dashboards, lists, and exports."
        actions={<SettingsBtn variant="primary">Save changes</SettingsBtn>}
      />
      <SettingsPageBody>
        <SettingsPreviewNote />
        <Section title="Dashboard defaults">
          <FieldGroup>
            <Field label="Default time range">
              <SettingsSelect
                value="24h"
                onChange={() => {}}
                options={[
                  { label: "Last 1 hour", value: "1h" },
                  { label: "Last 24 hours", value: "24h" },
                  { label: "Last 7 days", value: "7d" },
                  { label: "Last 30 days", value: "30d" },
                ]}
              />
            </Field>
            <Field label="Compact table density">
              <SettingsToggle on={false} onChange={() => {}} label="Use tighter row spacing in lists" />
            </Field>
            <Field label="Show resolved issues">
              <SettingsToggle on={false} onChange={() => {}} label="Include resolved error groups by default" />
            </Field>
          </FieldGroup>
        </Section>
        <Section title="Privacy">
          <FieldGroup>
            <Field label="Usage analytics">
              <SettingsToggle on onChange={() => {}} label="Help improve Telemetry Tracker with anonymous usage data" />
            </Field>
          </FieldGroup>
        </Section>
      </SettingsPageBody>
    </>
  );
}
