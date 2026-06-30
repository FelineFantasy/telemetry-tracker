"use client";

import Link from "next/link";
import {
  SettingsPageBody,
  SettingsPageHeader,
  SettingsComingSoonNote,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import { Section, SettingsPill } from "@/app/components/dashboard/settings/settings-ui";

const ENTRIES = [
  { date: "Jun 2026", title: "Dashboard shell redesign", tag: "UI", body: "Top navigation, settings hub, and pulse-beacon styling across the logged-in app." },
  { date: "May 2026", title: "Cookie consent & auth pages", tag: "UI", body: "Dedicated login/register routes and cookie policy." },
  { date: "Apr 2026", title: "Multi-tenant ingest", tag: "API", body: "Organization-scoped projects and API keys." },
];

export default function ChangelogSettingsPage() {
  return (
    <>
      <SettingsPageHeader title="What's new" description="Recent product updates." />
      <SettingsPageBody>
        <SettingsComingSoonNote />
        <Section title="Release notes">
          <ul className="space-y-6">
            {ENTRIES.map((e) => (
              <li key={e.title} className="border-b border-border pb-6 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{e.date}</span>
                  <SettingsPill tone="brand">{e.tag}</SettingsPill>
                </div>
                <h3 className="mt-2 text-[15px] font-medium">{e.title}</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">{e.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] text-muted-foreground">
            Full history on{" "}
            <Link href="https://github.com/Telemetry-Tracker/telemetry-tracker" className="text-brand hover:underline">
              GitHub
            </Link>
            .
          </p>
        </Section>
      </SettingsPageBody>
    </>
  );
}
