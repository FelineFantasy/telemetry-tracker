"use client";

import {
  SettingsPageBody,
  SettingsPageHeader,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import { Section } from "@/app/components/dashboard/settings/settings-ui";
import { ShellKbd } from "@/app/components/dashboard/shell/DashboardPopover";
import { DASHBOARD_SHORTCUTS } from "@/lib/dashboard-shortcuts";

export default function ShortcutsSettingsPage() {
  const groups = DASHBOARD_SHORTCUTS.reduce<Map<string, typeof DASHBOARD_SHORTCUTS>>((acc, item) => {
    const list = acc.get(item.group) ?? [];
    list.push(item);
    acc.set(item.group, list);
    return acc;
  }, new Map());

  return (
    <>
      <SettingsPageHeader
        title="Keyboard shortcuts"
        description="Quick navigation across the dashboard. Press ? anywhere in the app to open the cheat sheet."
      />
      <SettingsPageBody>
        {Array.from(groups.entries()).map(([group, items]) => (
          <Section key={group} title={group}>
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.label} className="flex items-center justify-between py-2.5">
                  <span className="text-[13px]">{item.label}</span>
                  <span className="flex items-center gap-1">
                    {item.keys.map((k) => (
                      <ShellKbd key={k}>{k}</ShellKbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ))}
      </SettingsPageBody>
    </>
  );
}
