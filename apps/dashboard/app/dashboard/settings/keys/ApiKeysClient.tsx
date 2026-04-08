"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createDashboardApiKey,
  revokeDashboardApiKey,
} from "@/app/dashboard/actions";
import { useDashboardCapabilities } from "@/app/components/dashboard/DashboardCapabilitiesContext";
import { Button } from "@/app/components/ui/Button";
import { Table, TableWrap } from "@/app/components/ui/Table";
import { TimeAgo } from "@/app/components/TimeAgo";

export type ApiKeyRow = {
  publicId: string;
  name: string | null;
  allowedApp: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function ApiKeysClient({ keys }: { keys: ApiKeyRow[] }) {
  const caps = useDashboardCapabilities();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [revokePending, setRevokePending] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  function onCreate(formData: FormData) {
    setFormError(null);
    startTransition(async () => {
      const r = await createDashboardApiKey(null, formData);
      if (r.ok) {
        setNewKey(r.key);
        router.refresh();
      } else {
        setFormError(r.error);
      }
    });
  }

  async function onRevoke(publicId: string) {
    if (!confirm("Revoke this key? SDKs using it will stop working.")) return;
    setRevokePending(publicId);
    const r = await revokeDashboardApiKey(publicId);
    setRevokePending(null);
    if (!r.ok) {
      alert(r.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="api-keys">
      {newKey ? (
        <div className="api-keys__banner card" role="status">
          <div className="card__label">New key — copy now</div>
          <p className="api-keys__warn">
            This secret is shown only once. Store it in an environment variable or secret manager.
          </p>
          <div className="api-keys__secret-wrap">
            <code className="api-keys__secret">{newKey}</code>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(newKey);
                } catch {
                  alert("Could not copy to clipboard.");
                }
              }}
            >
              Copy
            </Button>
          </div>
          <Button type="button" variant="ghost" onClick={() => setNewKey(null)}>
            Done
          </Button>
        </div>
      ) : null}

      {caps?.canCreateApiKey ? (
        <section className="api-keys__create card" aria-labelledby="create-key-heading">
          <h2 id="create-key-heading" className="api-keys__section-title">
            Create key
          </h2>
          <form action={onCreate} className="api-keys__form">
            <label className="api-keys__label" htmlFor="key-name">
              Label <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="key-name"
              name="name"
              type="text"
              className="filter-input api-keys__input"
              placeholder="e.g. production CI"
              maxLength={120}
              autoComplete="off"
              disabled={pending}
            />
            <label className="api-keys__label" htmlFor="key-allowed-app">
              Restrict to app <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="key-allowed-app"
              name="allowedApp"
              type="text"
              className="filter-input api-keys__input"
              placeholder="e.g. my-ios-app — must match SDK app field"
              maxLength={64}
              autoComplete="off"
              disabled={pending}
            />
            {formError ? (
              <p className="api-keys__error" role="alert">
                {formError}
              </p>
            ) : null}
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Creating…" : "Create API key"}
            </Button>
          </form>
        </section>
      ) : caps ? (
        <p className="text-muted-foreground api-keys__read-only-hint">
          You don&apos;t have permission to create API keys. Ask an organization owner.
        </p>
      ) : null}

      <section className="api-keys__list" aria-labelledby="keys-list-heading">
        <h2 id="keys-list-heading" className="api-keys__section-title">
          Keys for this project
        </h2>
        {keys.length === 0 ? (
          <p className="text-muted-foreground">
            {caps?.canCreateApiKey
              ? "No keys yet. Create one to send telemetry from your apps."
              : "No keys for this project yet."}
          </p>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Allowed app</th>
                  <th>Public id</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const revoked = Boolean(k.revokedAt);
                  return (
                    <tr key={k.publicId}>
                      <td>{k.name ?? "—"}</td>
                      <td>{k.allowedApp ?? "—"}</td>
                      <td>
                        <code className="api-keys__mono">{k.publicId}</code>
                      </td>
                      <td>
                        <TimeAgo iso={k.createdAt} />
                      </td>
                      <td>
                        {k.lastUsedAt ? <TimeAgo iso={k.lastUsedAt} /> : "—"}
                      </td>
                      <td>
                        {revoked ? (
                          <span className="badge api-keys__badge api-keys__badge--off">Revoked</span>
                        ) : (
                          <span className="badge api-keys__badge api-keys__badge--on">Active</span>
                        )}
                      </td>
                      <td className="api-keys__actions">
                        {!revoked && caps?.canRevokeApiKey ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="!min-h-9"
                            disabled={revokePending === k.publicId}
                            onClick={() => onRevoke(k.publicId)}
                          >
                            {revokePending === k.publicId ? "…" : "Revoke"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>
    </div>
  );
}
