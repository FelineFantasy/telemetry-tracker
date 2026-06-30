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
  SettingsPill,
  SettingsToggle,
} from "@/app/components/dashboard/settings/settings-ui";

export default function SecuritySettingsPage() {
  return (
    <>
      <SettingsPageHeader
        title="Security"
        description="Password, sessions, and account protection."
        actions={<SettingsBtn variant="primary">Save changes</SettingsBtn>}
      />
      <SettingsPageBody>
        <SettingsPreviewNote />
        <Section title="Password">
          <FieldGroup>
            <Field label="Password" hint="Last changed never (OAuth sign-in)">
              <SettingsBtn variant="default">Change password</SettingsBtn>
            </Field>
          </FieldGroup>
        </Section>
        <Section title="Two-factor authentication">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px]">Authenticator app</p>
              <p className="text-[12px] text-muted-foreground">
                Add a second factor for sign-in. Not available yet for self-hosted installs.
              </p>
            </div>
            <SettingsPill tone="muted">Coming soon</SettingsPill>
          </div>
        </Section>
        <Section title="Active sessions">
          <ul className="divide-y divide-border">
            {[
              { device: "macOS · Chrome", location: "Current session", current: true },
              { device: "iPhone · Safari", location: "Berlin, DE · 2 days ago", current: false },
            ].map((s) => (
              <li key={s.device} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <div className="text-[13px]">{s.device}</div>
                  <div className="text-[11px] text-muted-foreground">{s.location}</div>
                </div>
                {s.current ? (
                  <SettingsPill tone="success">This device</SettingsPill>
                ) : (
                  <SettingsBtn variant="ghost" size="sm">
                    Revoke
                  </SettingsBtn>
                )}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Sign-in alerts">
          <FieldGroup>
            <Field label="New device sign-in">
              <SettingsToggle on onChange={() => {}} label="Email me when a new device signs in" />
            </Field>
          </FieldGroup>
        </Section>
      </SettingsPageBody>
    </>
  );
}
