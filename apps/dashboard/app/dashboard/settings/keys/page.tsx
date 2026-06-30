import { SettingsPageHeader } from "@/app/components/dashboard/settings/SettingsPageHeader";
import { ErrorState } from "@/app/components/ErrorState";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { ApiKeysClient, type ApiKeyRow } from "./ApiKeysClient";

export const dynamic = "force-dynamic";

type KeysApiResponse = {
  keys: {
    publicId: string;
    name: string | null;
    allowedApp?: string | null;
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
    allowedApp: k.allowedApp ?? null,
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
        <SettingsPageHeader
          title="API keys"
          description="Keys belong to the project selected in the header. Telemetry sent with a key is stored in that project only."
        />
        <ErrorState message={loaded.message} />
      </>
    );
  }

  return (
    <>
      <SettingsPageHeader
        title="API keys"
        description="Keys belong to the project selected in the header. Telemetry sent with a key is stored in that project only."
      />
      <ApiKeysClient keys={loaded.keys} />
    </>
  );
}
