"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { fetchAuditLogAction } from "@/app/dashboard/actions";
import {
  SettingsPageBody,
  SettingsPageHeader,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import { EmptyState } from "@/app/components/EmptyState";
import { Section, SettingsBtn, SettingsPill } from "@/app/components/dashboard/settings/settings-ui";
import type { AuditLogEvent } from "@/lib/audit-log";
import { formatAbsoluteTime } from "@/lib/format-time";

export function AuditSettingsClient({
  organizationId,
  initialEvents,
  initialNextCursor,
}: {
  organizationId: string;
  initialEvents: AuditLogEvent[];
  initialNextCursor: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [events, setEvents] = useState(initialEvents);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);

  function loadMore() {
    if (!nextCursor || pending) return;
    startTransition(async () => {
      const result = await fetchAuditLogAction(organizationId, { cursor: nextCursor });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEvents((current) => [...current, ...result.events]);
      setNextCursor(result.nextCursor);
    });
  }

  return (
    <>
      <SettingsPageHeader
        title="Audit log"
        description="Organization activity for compliance and troubleshooting."
      />
      <SettingsPageBody>
        <Section title="Recent events">
          {events.length === 0 ? (
            <EmptyState
              title="No activity yet"
              message="Security, profile, and project PII scrubbing changes by organization members will appear here."
            />
          ) : (
            <>
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
                    {events.map((event) => (
                      <tr key={event.id} className="hover:bg-surface/40">
                        <td
                          className="px-2 py-2.5 font-mono text-[11px] text-muted-foreground"
                          title={formatAbsoluteTime(event.createdAt)}
                        >
                          {formatAbsoluteTime(event.createdAt)}
                        </td>
                        <td className="px-2 py-2.5">{event.actorEmail}</td>
                        <td className="px-2 py-2.5">
                          <SettingsPill tone="muted">{event.action}</SettingsPill>
                        </td>
                        <td className="px-2 py-2.5 font-mono text-[12px]">{event.target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {nextCursor ? (
                <div className="mt-4">
                  <SettingsBtn variant="ghost" size="sm" disabled={pending} onClick={loadMore}>
                    {pending ? "Loading…" : "Load more"}
                  </SettingsBtn>
                </div>
              ) : null}
            </>
          )}
        </Section>
      </SettingsPageBody>
    </>
  );
}
