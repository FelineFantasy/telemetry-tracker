"use client";

import {
  SettingsPageBody,
  SettingsPageHeader,
  SettingsPreviewNote,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import { Section, SettingsPill } from "@/app/components/dashboard/settings/settings-ui";

const EVENTS = [
  { time: "2026-06-28 14:22", actor: "you@example.com", action: "project.create", target: "mobile-app" },
  { time: "2026-06-28 11:05", actor: "you@example.com", action: "api_key.create", target: "ingest-prod" },
  { time: "2026-06-27 09:18", actor: "you@example.com", action: "member.invite", target: "colleague@example.com" },
];

export default function AuditSettingsPage() {
  return (
    <>
      <SettingsPageHeader
        title="Audit log"
        description="Organization activity for compliance and troubleshooting."
      />
      <SettingsPageBody>
        <SettingsPreviewNote />
        <Section title="Recent events">
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Actor</th>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {EVENTS.map((e) => (
                  <tr key={`${e.time}-${e.action}`} className="hover:bg-surface/40">
                    <td className="px-2 py-2.5 font-mono text-[11px] text-muted-foreground">{e.time}</td>
                    <td className="px-2 py-2.5">{e.actor}</td>
                    <td className="px-2 py-2.5">
                      <SettingsPill tone="muted">{e.action}</SettingsPill>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[12px]">{e.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </SettingsPageBody>
    </>
  );
}
