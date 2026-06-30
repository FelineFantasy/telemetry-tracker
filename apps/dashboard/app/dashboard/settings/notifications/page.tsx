"use client";

import {
  SettingsPageBody,
  SettingsPageHeader,
  SettingsComingSoonNote,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import {
  Field,
  FieldGroup,
  Section,
  SettingsBtn,
  SettingsSelect,
  SettingsToggle,
} from "@/app/components/dashboard/settings/settings-ui";

const CHANNELS = [
  { id: "inapp", label: "In-app", desc: "Notification center bell" },
  { id: "email", label: "Email", desc: "Primary account email" },
];

const CATEGORIES = [
  { id: "issues", label: "Issues", desc: "New error groups and regressions" },
  { id: "billing", label: "Billing", desc: "Quota thresholds and payment issues" },
  { id: "team", label: "Team", desc: "Invitations and mentions" },
];

export default function NotificationsSettingsPage() {
  return (
    <>
      <SettingsPageHeader
        title="Notifications"
        description="Control where and when Telemetry Tracker reaches you."
        actions={<SettingsBtn variant="primary">Save changes</SettingsBtn>}
      />
      <SettingsPageBody>
        <SettingsComingSoonNote />
        <Section title="Channels">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CHANNELS.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface/40 p-3"
              >
                <span className="grid h-8 w-8 place-items-center rounded-md bg-surface text-[11px] font-mono">
                  {c.label.charAt(0)}
                </span>
                <div className="flex-1">
                  <div className="text-[13px]">{c.label}</div>
                  <div className="text-[11px] text-muted-foreground">{c.desc}</div>
                </div>
                <SettingsToggle on onChange={() => {}} />
              </div>
            ))}
          </div>
        </Section>
        <Section title="Routing">
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2">Category</th>
                  {CHANNELS.map((c) => (
                    <th key={c.id} className="px-2 py-2 text-center">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {CATEGORIES.map((cat) => (
                  <tr key={cat.id}>
                    <td className="px-2 py-3">
                      <div className="font-medium">{cat.label}</div>
                      <div className="text-[11px] text-muted-foreground">{cat.desc}</div>
                    </td>
                    {CHANNELS.map((c, i) => (
                      <td key={c.id} className="px-2 py-3 text-center">
                        <SettingsToggle on={i % 2 === 0} onChange={() => {}} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="Quiet hours">
          <FieldGroup>
            <Field label="Enable quiet hours">
              <SettingsToggle on={false} onChange={() => {}} label="Mute non-critical alerts" />
            </Field>
            <Field label="From / To">
              <div className="flex items-center gap-2">
                <SettingsSelect
                  value="22"
                  onChange={() => {}}
                  options={Array.from({ length: 24 }, (_, h) => ({
                    label: `${h.toString().padStart(2, "0")}:00`,
                    value: String(h),
                  }))}
                  className="!w-28"
                />
                <span className="text-muted-foreground">→</span>
                <SettingsSelect
                  value="7"
                  onChange={() => {}}
                  options={Array.from({ length: 24 }, (_, h) => ({
                    label: `${h.toString().padStart(2, "0")}:00`,
                    value: String(h),
                  }))}
                  className="!w-28"
                />
              </div>
            </Field>
          </FieldGroup>
        </Section>
      </SettingsPageBody>
    </>
  );
}
