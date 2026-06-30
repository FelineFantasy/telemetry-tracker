"use client";

import { useState } from "react";
import {
  SettingsPageBody,
  SettingsPageHeader,
  SettingsComingSoonNote,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import {
  Field,
  FieldGroup,
  Section,
  SettingsAvatar,
  SettingsBtn,
  SettingsInput,
  SettingsPill,
  SettingsSelect,
  SettingsTextarea,
  SettingsToggle,
} from "@/app/components/dashboard/settings/settings-ui";

export default function ProfileSettingsPage() {
  const [displayName, setDisplayName] = useState("Telemetry user");
  const [email] = useState("you@example.com");
  const [job, setJob] = useState("");
  const [bio, setBio] = useState("");
  const [tz, setTz] = useState("UTC");
  const [lang, setLang] = useState("en-US");

  return (
    <>
      <SettingsPageHeader
        title="Profile"
        description="How you appear across Telemetry Tracker. Some of this is visible to other members of your organization."
        actions={
          <>
            <SettingsBtn variant="ghost">Discard</SettingsBtn>
            <SettingsBtn variant="primary">Save changes</SettingsBtn>
          </>
        }
      />
      <SettingsPageBody>
        <SettingsComingSoonNote />
        <Section title="Avatar" description="PNG, JPG or GIF. 2 MB max.">
          <div className="flex items-center gap-5">
            <SettingsAvatar name={displayName} size={72} />
            <div className="flex flex-wrap items-center gap-2">
              <SettingsBtn variant="default">Upload new</SettingsBtn>
              <SettingsBtn variant="ghost">Remove</SettingsBtn>
            </div>
          </div>
        </Section>
        <Section title="Profile information">
          <FieldGroup>
            <Field label="Display name">
              <SettingsInput value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Field label="Email">
              <div className="flex items-center gap-2">
                <SettingsInput value={email} readOnly className="flex-1" />
                <SettingsPill tone="success">Verified</SettingsPill>
              </div>
            </Field>
            <Field label="Job title" optional>
              <SettingsInput value={job} onChange={(e) => setJob(e.target.value)} />
            </Field>
            <Field label="Bio" optional>
              <SettingsTextarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
            </Field>
          </FieldGroup>
        </Section>
        <Section title="Regional">
          <FieldGroup>
            <Field label="Timezone">
              <SettingsSelect
                value={tz}
                onChange={setTz}
                options={[
                  { label: "UTC", value: "UTC" },
                  { label: "Europe/Berlin", value: "Europe/Berlin" },
                  { label: "America/New_York", value: "America/New_York" },
                ]}
              />
            </Field>
            <Field label="Language">
              <SettingsSelect
                value={lang}
                onChange={setLang}
                options={[
                  { label: "English (United States)", value: "en-US" },
                  { label: "English (United Kingdom)", value: "en-GB" },
                  { label: "Deutsch", value: "de-DE" },
                ]}
              />
            </Field>
          </FieldGroup>
        </Section>
        <Section title="Profile visibility">
          <FieldGroup>
            <Field label="Show in member directory">
              <SettingsToggle on onChange={() => {}} label="Visible to your organization" />
            </Field>
            <Field label="Discoverable by email">
              <SettingsToggle on={false} onChange={() => {}} label="Allow invites by email" />
            </Field>
          </FieldGroup>
        </Section>
      </SettingsPageBody>
    </>
  );
}
