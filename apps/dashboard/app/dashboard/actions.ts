"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import {
  DEFAULT_PROJECT_ID,
  TELEMETRY_PROJECT_COOKIE,
} from "@/lib/dashboard-project";

export async function setDashboardProjectId(projectId: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const trimmed = projectId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(trimmed)) {
    return { ok: false, error: "Invalid project id" };
  }
  const c = await cookies();
  c.set(TELEMETRY_PROJECT_COOKIE, trimmed.toLowerCase(), {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
    httpOnly: true,
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/** Clear cookie → API falls back to default project. */
export async function resetDashboardProjectId(): Promise<void> {
  const c = await cookies();
  c.set(TELEMETRY_PROJECT_COOKIE, DEFAULT_PROJECT_ID, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
    httpOnly: true,
  });
  revalidatePath("/dashboard", "layout");
}

export type CreateApiKeyResult =
  | { ok: true; key: string; publicId: string; name: string | null }
  | { ok: false; error: string };

export async function createDashboardApiKey(
  _prev: CreateApiKeyResult | null,
  formData: FormData
): Promise<CreateApiKeyResult> {
  const raw = formData.get("name");
  const name =
    typeof raw === "string" && raw.trim() !== "" ? raw.trim().slice(0, 120) : undefined;
  const res = await dashboardApiFetch("/api/project/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(name ? { name } : {}),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: t.slice(0, 400) || res.statusText };
  }
  const data = (await res.json()) as {
    key: string;
    publicId: string;
    name: string | null;
  };
  revalidatePath("/dashboard/settings/keys");
  return {
    ok: true,
    key: data.key,
    publicId: data.publicId,
    name: data.name,
  };
}

export async function revokeDashboardApiKey(
  publicId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = publicId.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id)) {
    return { ok: false, error: "Invalid key id" };
  }
  const res = await dashboardApiFetch(`/api/project/api-keys/${id}/revoke`, {
    method: "POST",
  });
  if (res.status === 204) {
    revalidatePath("/dashboard/settings/keys");
    return { ok: true };
  }
  const t = await res.text();
  return { ok: false, error: t.slice(0, 400) || res.statusText };
}
