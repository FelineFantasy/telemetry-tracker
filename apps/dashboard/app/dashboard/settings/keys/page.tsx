import { PageTitle } from "@/app/components/PageTitle";
import { ErrorState } from "@/app/components/ErrorState";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { ApiKeysClient, type ApiKeyRow } from "./ApiKeysClient";

export const dynamic = "force-dynamic";

type KeysApiResponse = {
  keys: {
    publicId: string;
    name: string | null;
    createdAt: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
  }[];
};

async function loadKeys(): Promise<{ ok: true; keys: ApiKeyRow[] } | { ok: false; message: string }> {
  const res = await dashboardApiFetch("/api/project/api-keys");
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, message: `Could not load keys (${res.status}): ${t.slice(0, 200)}` };
  }
  const data = (await res.json()) as KeysApiResponse;
  const keys: ApiKeyRow[] = (data.keys ?? []).map((k) => ({
    publicId: k.publicId,
    name: k.name,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    revokedAt: k.revokedAt,
  }));
  return { ok: true, keys };
}

export default async function ApiKeysSettingsPage() {
  const loaded = await loadKeys();
  if (!loaded.ok) {
    return (
      <>
        <PageTitle title="API keys" context="Create and revoke ingestion keys for the active project." />
        <ErrorState message={loaded.message} />
      </>
    );
  }

  return (
    <>
      <PageTitle title="API keys" context="Create and revoke ingestion keys for the active project." />
      <ApiKeysClient keys={loaded.keys} />
    </>
  );
}
