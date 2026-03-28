import { cookies } from "next/headers";

/** Cookie storing the active dashboard project (matches API `X-Project-Id`). */
export const TELEMETRY_PROJECT_COOKIE = "telemetry_project_id";

/** Default from migration + `TELEMETRY_PROJECT_ID` (same as API `readProjectIdFromEnv`). */
export const DEFAULT_PROJECT_ID =
  process.env.TELEMETRY_PROJECT_ID?.trim() ||
  "a0000000-0000-4000-8000-000000000002";

export async function getDashboardProjectId(): Promise<string> {
  const c = await cookies();
  const v = c.get(TELEMETRY_PROJECT_COOKIE)?.value?.trim();
  if (v && /^[0-9a-f-]{36}$/i.test(v)) {
    return v;
  }
  return DEFAULT_PROJECT_ID;
}

export function dashboardApiHeaders(projectId: string): Record<string, string> {
  return { "X-Project-Id": projectId };
}
