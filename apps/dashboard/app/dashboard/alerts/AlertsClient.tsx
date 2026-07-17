"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createProjectWebhookAction,
  deleteProjectWebhookAction,
  saveProjectAlertSettingsAction,
  saveProjectPiiScrubSettingsAction,
  testProjectWebhookAction,
  updateProjectWebhookAction,
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
import type {
  AlertWebhookDeliveryRow,
  ProjectWebhookRow,
} from "@/lib/project-webhooks";

function deliveryStatusLabel(status: AlertWebhookDeliveryRow["status"]): string {
  switch (status) {
    case "SUCCESS":
      return "Success";
    case "FAILED":
      return "Failed";
    case "DEAD":
      return "Dead";
    default:
      return status;
  }
}

export function AlertsClient({
  initialSettings,
  initialEvents,
  initialWebhooks,
  initialDeliveries,
  initialPiiSettings,
  piiSettingsLoadError = null,
  canEdit,
}: {
  initialSettings: ProjectAlertSettings;
  initialEvents: AlertEventRow[];
  initialWebhooks: ProjectWebhookRow[];
  initialDeliveries: AlertWebhookDeliveryRow[];
  initialPiiSettings: ProjectPiiScrubSettings;
  /** When set, PII section is read-only — do not save (avoids wiping deny-keys). */
  piiSettingsLoadError?: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [piiPending, startPiiTransition] = useTransition();
  const [webhookPending, startWebhookTransition] = useTransition();
  const [settings, setSettings] = useState(initialSettings);
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookLabel, setWebhookLabel] = useState("");
  const [lastSigningSecret, setLastSigningSecret] = useState<{
    webhookId: string;
    secret: string;
  } | null>(null);
  const [denyKeysText, setDenyKeysText] = useState(() =>
    formatDenyKeysInput(initialPiiSettings.denyKeys)
  );
  const [scrubSessionUserEmail, setScrubSessionUserEmail] = useState(
    () => initialPiiSettings.scrubSessionUserEmail
  );
  const [savedPii, setSavedPii] = useState(() =>
    normalizeProjectPiiScrubSettings(initialPiiSettings)
  );
  const piiEditable = canEdit && !piiSettingsLoadError;

  useEffect(() => {
    setWebhooks(initialWebhooks);
    setLastSigningSecret((prev) =>
      prev && initialWebhooks.some((w) => w.id === prev.webhookId) ? prev : null
    );
  }, [initialWebhooks]);

  // After router.refresh(), props can recover from a failed load while useState
  // still holds fallback defaults — resync so a later save cannot wipe real keys.
  // Key on values (not object identity) so alert-settings refresh does not discard
  // unsaved PII edits when the server returns a new props object with the same data.
  const piiPropsSyncKey = piiSettingsLoadError
    ? `error:${piiSettingsLoadError}`
    : `ok:${initialPiiSettings.scrubSessionUserEmail}:${initialPiiSettings.denyKeys.join("\0")}`;
  const lastSyncedPiiKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (piiSettingsLoadError) return;
    if (lastSyncedPiiKeyRef.current === piiPropsSyncKey) return;
    lastSyncedPiiKeyRef.current = piiPropsSyncKey;
    const normalized = normalizeProjectPiiScrubSettings(initialPiiSettings);
    setSavedPii(normalized);
    setDenyKeysText(formatDenyKeysInput(normalized.denyKeys));
    setScrubSessionUserEmail(normalized.scrubSessionUserEmail);
  }, [piiPropsSyncKey, piiSettingsLoadError, initialPiiSettings]);

  const dirty = useMemo(
    () => !alertSettingsEqual(settings, initialSettings),
    [settings, initialSettings]
  );
  const piiDirty = useMemo(() => {
    if (piiSettingsLoadError) return false;
    const next: ProjectPiiScrubSettings = {
      denyKeys: parseDenyKeysInput(denyKeysText),
      scrubSessionUserEmail,
    };
    return !piiScrubSettingsEqual(next, savedPii);
  }, [denyKeysText, scrubSessionUserEmail, savedPii, piiSettingsLoadError]);

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
    if (piiSettingsLoadError) {
      toast.error(piiSettingsLoadError);
      return;
    }
    startPiiTransition(async () => {
      const nextDeny = parseDenyKeysInput(denyKeysText);
      const patch: Partial<ProjectPiiScrubSettings> = {};
      if (
        nextDeny.length !== savedPii.denyKeys.length ||
        nextDeny.some((k, i) => k !== savedPii.denyKeys[i])
      ) {
        patch.denyKeys = nextDeny;
      }
      if (scrubSessionUserEmail !== savedPii.scrubSessionUserEmail) {
        patch.scrubSessionUserEmail = scrubSessionUserEmail;
      }
      const result = await saveProjectPiiScrubSettingsAction(patch);
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

  function reloadPiiSettings() {
    startPiiTransition(() => {
      router.refresh();
    });
  }

  function addWebhook() {
    startWebhookTransition(async () => {
      const result = await createProjectWebhookAction({
        url: webhookUrl,
        label: webhookLabel.trim() || undefined,
        withSigningSecret: true,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setWebhooks((prev) => [...prev, result.webhook]);
      setWebhookUrl("");
      setWebhookLabel("");
      setLastSigningSecret(
        result.signingSecret
          ? { webhookId: result.webhook.id, secret: result.signingSecret }
          : null
      );
      toast.success("Webhook added");
      router.refresh();
    });
  }

  function toggleWebhook(id: string, enabled: boolean) {
    startWebhookTransition(async () => {
      const result = await updateProjectWebhookAction(id, { enabled });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setWebhooks((prev) => prev.map((w) => (w.id === id ? result.webhook : w)));
    });
  }

  function removeWebhook(id: string) {
    startWebhookTransition(async () => {
      const result = await deleteProjectWebhookAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      setLastSigningSecret((prev) => (prev?.webhookId === id ? null : prev));
      toast.success("Webhook removed");
      router.refresh();
    });
  }

  function testWebhook(id: string) {
    startWebhookTransition(async () => {
      const result = await testProjectWebhookAction(id);
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success(`Test delivered (HTTP ${result.httpStatus})`);
      router.refresh();
    });
  }

  return (
    <>
      <SettingsPageHeader
        title="Alerts"
        description="Threshold rules for the active project. Fired alerts appear in the notification bell, email owners and editors, and POST to configured webhooks."
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
          description="Email uses notification preferences. HTTPS webhooks receive JSON when an alert fires (error spike or quota)."
        >
          <p className="mb-3 text-[13px] text-muted-foreground">
            Configure in-app and email routing under{" "}
            <Link href="/dashboard/settings/notifications" className="text-brand hover:underline">
              Notification settings
            </Link>
            . Payload schema lives in{" "}
            <code className="font-mono text-[11px]">docs/ALERT-WEBHOOKS.md</code>.
          </p>

          {lastSigningSecret ? (
            <div
              className="mb-3 rounded-md border border-border bg-surface/40 p-3"
              role="status"
            >
              <p className="text-[12px] font-medium text-foreground">
                Signing secret (copy now — shown once)
              </p>
              <code className="mt-1 block break-all font-mono text-[11px] text-muted-foreground">
                {lastSigningSecret.secret}
              </code>
              <button
                type="button"
                className="mt-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => setLastSigningSecret(null)}
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {webhooks.length > 0 ? (
            <ul className="mb-4 divide-y divide-border rounded-md border border-border">
              {webhooks.map((wh) => (
                <li
                  key={wh.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">
                      {wh.label?.trim() || "Webhook"}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {wh.urlMasked}
                      {wh.hasSigningSecret ? " · signed" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={canEdit ? undefined : "pointer-events-none opacity-50"}>
                      <SettingsToggle
                        on={wh.enabled}
                        onChange={(enabled) => toggleWebhook(wh.id, enabled)}
                        disabled={!canEdit || webhookPending}
                      />
                    </div>
                    {canEdit ? (
                      <>
                        <SettingsBtn
                          variant="outline"
                          disabled={webhookPending}
                          onClick={() => testWebhook(wh.id)}
                        >
                          Test
                        </SettingsBtn>
                        <SettingsBtn
                          variant="outline"
                          disabled={webhookPending}
                          onClick={() => removeWebhook(wh.id)}
                        >
                          Remove
                        </SettingsBtn>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-[13px] text-muted-foreground">
              No webhooks configured for this project yet.
            </p>
          )}

          {canEdit ? (
            <FieldGroup>
              <Field label="HTTPS URL">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.example.com/alerts"
                  disabled={webhookPending}
                  className="w-full max-w-xl rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[12px] disabled:opacity-50"
                />
              </Field>
              <Field label="Label (optional)">
                <input
                  type="text"
                  value={webhookLabel}
                  onChange={(e) => setWebhookLabel(e.target.value)}
                  placeholder="Ops channel"
                  disabled={webhookPending}
                  className="w-full max-w-xs rounded-md border border-border bg-background px-2 py-1.5 text-[13px] disabled:opacity-50"
                />
              </Field>
              <div>
                <SettingsBtn
                  variant="primary"
                  disabled={webhookPending || webhookUrl.trim().length === 0}
                  onClick={addWebhook}
                >
                  {webhookPending ? "Saving…" : "Add webhook"}
                </SettingsBtn>
              </div>
            </FieldGroup>
          ) : null}

          <div className="mt-6">
            <p className="mb-2 text-[13px] font-medium text-foreground">
              Recent webhook deliveries
            </p>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Last 25 attempts (including tests). Failed retries are recorded before a final dead
              letter.
            </p>
            {initialDeliveries.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No webhook deliveries yet.</p>
            ) : (
              <AnalyticsPanel>
                <AnalyticsPanelHeader
                  title="Webhook deliveries"
                  description="Newest first"
                />
                <AnalyticsPanelList>
                  {initialDeliveries.map((d) => (
                    <li key={d.id} className="px-4 py-3 sm:px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">
                            {d.webhookLabel?.trim() || "Webhook"}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                            {d.webhookUrlMasked}
                          </p>
                          <p className="mt-1 text-[12px] text-muted-foreground">
                            {d.error
                              ? d.error
                              : d.httpStatus != null
                                ? `HTTP ${d.httpStatus}`
                                : "No HTTP status"}
                            {d.attempt > 1 ? ` · attempt ${d.attempt}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {deliveryStatusLabel(d.status)}
                          </span>
                          <p
                            className="mt-1 font-mono text-[10px] text-muted-foreground"
                            title={d.createdAt}
                          >
                            {formatRelativeTime(d.createdAt)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </AnalyticsPanelList>
              </AnalyticsPanel>
            )}
          </div>
        </Section>

        <Section
          title="PII scrubbing"
          description="Default server-side ingest already redacts common emails, tokens, secrets, and conservative phone/card patterns. This section only adds project deny-keys and an optional session-email setting — it cannot weaken the defaults."
          actions={
            piiEditable ? (
              <SettingsBtn
                variant="primary"
                disabled={!piiDirty || piiPending}
                onClick={savePii}
              >
                {piiPending ? "Saving…" : "Save PII settings"}
              </SettingsBtn>
            ) : null
          }
        >
          {piiSettingsLoadError ? (
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3" role="alert">
              <p className="text-[13px] text-destructive">
                {piiSettingsLoadError}. Saving is disabled so existing deny-keys are not
                overwritten.
              </p>
              <SettingsBtn
                variant="outline"
                disabled={piiPending}
                onClick={reloadPiiSettings}
              >
                {piiPending ? "Reloading…" : "Reload settings"}
              </SettingsBtn>
            </div>
          ) : null}
          <FieldGroup>
            <Field
              label="Deny-listed field names"
              hint="One field name per line (or comma-separated). Matched case-insensitively on property/context keys — for example nationalId or customer_ref. Additive only; field names, not regex patterns."
            >
              <SettingsTextarea
                id="pii-deny-keys"
                rows={5}
                disabled={!piiEditable}
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
              hint="When enabled, ingest stores Session.user_email as the placeholder [email] (not null) before persistence. Off by default. Enabling removes the real address from new sessions and may reduce user-level debugging and email search."
            >
              <div className={piiEditable ? undefined : "pointer-events-none opacity-50"}>
                <SettingsToggle
                  id="pii-scrub-session-email"
                  label="Scrub session user email"
                  on={scrubSessionUserEmail}
                  onChange={setScrubSessionUserEmail}
                  disabled={!piiEditable}
                />
              </div>
            </Field>
          </FieldGroup>
          <p id="pii-deny-keys-help" className="mt-2 text-[12px] text-muted-foreground">
            Layers: (1) default server scrubbing on ingest; (2) optional SDK{" "}
            <code className="font-mono text-[11px]">piiScrub</code> before send (does not touch
            session identity); (3) this project’s deny-keys and session-email toggle. Phone/card
            heuristics miss bare digit runs by design and can false-positive on Luhn-valid IDs.
            Settings changes are recorded in the organization audit log (counts only). See{" "}
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
