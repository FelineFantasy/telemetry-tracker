import { dashboardApiFetch } from "@/lib/dashboard-api";

export type AuditLogEvent = {
  id: string;
  createdAt: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  target: string;
};

export type FetchAuditLogResult =
  | {
      ok: true;
      organizationId: string;
      events: AuditLogEvent[];
      nextCursor: string | null;
    }
  | { ok: false; error: string };

export async function fetchAuditLog(
  organizationId: string,
  options?: { cursor?: string; limit?: number }
): Promise<FetchAuditLogResult> {
  const params = new URLSearchParams();
  if (options?.cursor) params.set("cursor", options.cursor);
  if (options?.limit) params.set("limit", String(options.limit));
  const q = params.toString();
  const path = `/api/meta/organizations/${encodeURIComponent(organizationId)}/audit-log${
    q ? `?${q}` : ""
  }`;

  const res = await dashboardApiFetch(path, undefined, {
    organizationIdOverride: organizationId,
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text) as { error?: string };
      if (typeof data.error === "string" && data.error.trim()) {
        return { ok: false, error: data.error };
      }
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: `Could not load audit log (${res.status}): ${text.slice(0, 200)}`,
    };
  }

  try {
    const data = (await res.json()) as {
      organizationId?: string;
      events?: AuditLogEvent[];
      nextCursor?: string | null;
    };
    return {
      ok: true,
      organizationId: data.organizationId ?? organizationId,
      events: Array.isArray(data.events) ? data.events : [],
      nextCursor: data.nextCursor ?? null,
    };
  } catch {
    return { ok: false, error: "Invalid response from server" };
  }
}
