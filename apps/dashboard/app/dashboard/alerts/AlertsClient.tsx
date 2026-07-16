"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  saveProjectAlertSettingsAction,
  saveProjectPiiScrubSettingsAction,
} from "@/app/dashboard/actions";
import {
  AnalyticsPanel,
  AnalyticsPanelHeader,
  AnalyticsPanelList,
} from "@/app/components/dashboard/analytics-ui";
import {
  SettingsPageBody,
  SettingsPageHeader,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import {
  Field,
  FieldGroup,
  Section,
  SettingsBtn,
  SettingsTextarea,
  SettingsToggle,
} from "@/app/components/dashboard/settings/settings-ui";
import {
  alertSettingsEqual,
  ruleLabel,
  type AlertEventRow,
  type ProjectAlertSettings,
} from "@/lib/alert-settings";
import {
  formatDenyKeysInput,
  normalizeProjectPiiScrubSettings,
  parseDenyKeysInput,
  piiScrubSettingsEqual,
  type ProjectPiiScrubSettings,
} from "@/lib/pii-scrub-settings";
import { formatRelativeTime } from "@/lib/format-time";

export function AlertsClient({
  initialSettings,
  initialEvents,
  initialPiiSettings,
  canEdit,
}: {
  initialSettings: ProjectAlertSettings;
  initialEvents: AlertEventRow[];
  initialPiiSettings: ProjectPiiScrubSettings;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [piiPending, startPiiTransition] = useTransition();
  const [settings, setSettings] = useState(initialSettings);
  const [denyKeysText, setDenyKeysText] = useState(() =>
    formatDenyKeysInput(initialPiiSettings.denyKeys)
  );
  const [scrubSessionUserEmail, setScrubSessionUserEmail] = useState(
    () => initialPiiSettings.scrubSessionUserEmail
  );
  const [savedPii, setSavedPii] = useState(() =>
    normalizeProjectPiiScrubSettings(initialPiiSettings)
  );
  const dirty = useMemo(
    () => !alertSettingsEqual(settings, initialSettings),
    [settings, initialSettings]
  );
  const piiDirty = useMemo(() => {
    const next: ProjectPiiScrubSettings = {
      denyKeys: parseDenyKeysInput(denyKeysText),
      scrubSessionUserEmail,
    };
    return !piiScrubSettingsEqual(next, savedPii);
  }, [denyKeysText, scrubSessionUserEmail, savedPii]);

  function save() {
    startTransition(async () => {
      const result = await saveProjectAlertSettingsAction(settings);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Alert settings saved");
      setSettings(result.settings);
      router.refresh();
    });
  }

  function savePii() {
    startPiiTransition(async () => {
      const next: ProjectPiiScrubSettings = {
        denyKeys: parseDenyKeysInput(denyKeysText),
        scrubSessionUserEmail,
      };
      const result = await saveProjectPiiScrubSettingsAction(next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("PII scrub settings saved");
      const normalized = normalizeProjectPiiScrubSettings(result.settings);
      setSavedPii(normalized);
      setDenyKeysText(formatDenyKeysInput(normalized.denyKeys));
      setScrubSessionUserEmail(normalized.scrubSessionUserEmail);
      router.refresh();
    });
  }

  return (
    <>
      <SettingsPageHeader
        title="Alerts"
        description="Threshold rules for the active project. Fired alerts appear in the notification bell and can email owners and editors."
        actions={
          canEdit ? (
            <SettingsBtn variant="primary" disabled={!dirty || pending} onClick={save}>
              {pending ? "Saving…" : "Save changes"}
            </SettingsBtn>
          ) : null
        }
      />
      <SettingsPageBody>
        {!canEdit ? (
          <p className="mb-4 text-[13px] text-muted-foreground">
            You need editor or owner access to change alert rules.
          </p>
        ) : null}

        <Section
          title="Error spike"
          description="Fire when error occurrences in a rolling window exceed your threshold."
        >
          <FieldGroup>
            <Field label="Enable error spike alerts">
              <div className={canEdit ? undefined : "pointer-events-none opacity-50"}>
                <SettingsToggle
                  on={settings.errorSpike.enabled}
                  onChange={(enabled) =>
                    setSettings((s) => ({
                      ...s,
                      errorSpike: { ...s.errorSpike, enabled },
                    }))
                  }
                />
              </div>
            </Field>
            <Field label="Threshold (errors per window)">
              <input
                type="number"
                min={1}
                max={10000}
                disabled={!canEdit || !settings.errorSpike.enabled}
                value={settings.errorSpike.threshold}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    errorSpike: {
                      ...s.errorSpike,
                      threshold: Number(e.target.value) || 1,
                    },
                  }))
                }
                className="w-32 rounded-md border border-border bg-background px-2 py-1.5 text-[13px] disabled:opacity-50"
              />
            </Field>
            <Field label="Window (minutes)">
              <input
                type="number"
                min={5}
                max={1440}
                disabled={!canEdit || !settings.errorSpike.enabled}
                value={settings.errorSpike.windowMinutes}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    errorSpike: {
                      ...s.errorSpike,
                      windowMinutes: Number(e.target.value) || 15,
                    },
                  }))
                }
                className="w-32 rounded-md border border-border bg-background px-2 py-1.5 text-[13px] disabled:opacity-50"
              />
            </Field>
          </FieldGroup>
        </Section>

        <Section
          title="Ingest quota"
          description="Warn before monthly ingest limits are reached. Exceeded alerts always fire when ingest is rejected."
        >
          <FieldGroup>
            <Field label="Enable quota warnings">
              <div className={canEdit ? undefined : "pointer-events-none opacity-50"}>
                <SettingsToggle
                  on={settings.quota.enabled}
                  onChange={(enabled) =>
                    setSettings((s) => ({
                      ...s,
                      quota: { ...s.quota, enabled },
                    }))
                  }
                />
              </div>
            </Field>
            <Field label="Warning threshold (%)">
              <input
                type="number"
                min={50}
                max={99}
                disabled={!canEdit || !settings.quota.enabled}
                value={settings.quota.nearPercent}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    quota: {
                      ...s.quota,
                      nearPercent: Number(e.target.value) || 90,
                    },
                  }))
                }
                className="w-32 rounded-md border border-border bg-background px-2 py-1.5 text-[13px] disabled:opacity-50"
              />
            </Field>
          </FieldGroup>
        </Section>

        <Section
          title="Delivery"
          description="Email delivery uses your notification preferences. Webhooks and Slack are planned for a future release."
        >
          <p className="text-[13px] text-muted-foreground">
            Configure in-app and email routing under{" "}
            <Link href="/dashboard/settings/notifications" className="text-brand hover:underline">
              Notification settings
            </Link>
            . Alert notifications use the Alerts category.
          </p>
        </Section>

        <Section
          title="PII scrubbing"
          description="Server-side ingest already redacts common emails, tokens, and secrets. Add extra property or context field names to always redact for this project (not regex patterns)."
          actions={
            canEdit ? (
              <SettingsBtn
                variant="primary"
                disabled={!piiDirty || piiPending}
                onClick={savePii}
              >
                {piiPending ? "Saving…" : "Save deny-list"}
              </SettingsBtn>
            ) : null
          }
        >
          <FieldGroup>
            <Field
              label="Deny-listed field names"
              hint="One field name per line (or comma-separated). Matched case-insensitively on property/context keys — for example nationalId or customer_ref. These are additive to built-in protections and cannot turn them off. Field names only — not regex patterns."
            >
              <SettingsTextarea
                id="pii-deny-keys"
                rows={5}
                disabled={!canEdit}
                value={denyKeysText}
                onChange={(e) => setDenyKeysText(e.target.value)}
                placeholder={"nationalId\ncustomerRef"}
                className="font-mono text-[12px]"
                aria-label="Deny-listed field names"
                aria-describedby="pii-deny-keys-help"
              />
            </Field>
            <Field
              label="Scrub session user email"
              hint="When enabled, Session.user_email is redacted to [email] on ingest. Off by default so session search by email keeps working until you opt in."
            >
              <div className={canEdit ? undefined : "pointer-events-none opacity-50"}>
                <SettingsToggle
                  label="Scrub session user email"
                  on={scrubSessionUserEmail}
                  onChange={setScrubSessionUserEmail}
                  disabled={!canEdit}
                />
              </div>
            </Field>
          </FieldGroup>
          <p id="pii-deny-keys-help" className="mt-2 text-[12px] text-muted-foreground">
            Optional client-side scrubbing is available in{" "}
            <code className="font-mono text-[11px]">@telemetry-tracker/core</code> via{" "}
            <code className="font-mono text-[11px]">piiScrub</code> (default off). Changes are
            recorded in the organization audit log. See{" "}
            <Link href="/docs/sdk" className="text-brand hover:underline">
              SDK docs
            </Link>
            .
          </p>
        </Section>

        <Section title="Recent alerts" description="Last 25 fired alerts for this project.">
          {initialEvents.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No alerts fired yet.</p>
          ) : (
            <AnalyticsPanel>
              <AnalyticsPanelHeader title="Recent alerts" description="Newest first" />
              <AnalyticsPanelList>
                {initialEvents.map((event) => (
                  <li key={event.id} className="px-4 py-3 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">{event.title}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{event.body}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {ruleLabel(event.rule)}
                        </span>
                        <p
                          className="mt-1 font-mono text-[10px] text-muted-foreground"
                          title={event.firedAt}
                        >
                          {formatRelativeTime(event.firedAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </AnalyticsPanelList>
            </AnalyticsPanel>
          )}
        </Section>
      </SettingsPageBody>
    </>
  );
}
