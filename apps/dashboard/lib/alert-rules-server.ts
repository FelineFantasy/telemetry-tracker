import { dashboardApiFetch } from "@/lib/dashboard-api";
import { isAlertRuleRow, type AlertRuleRow } from "@/lib/alert-rules";

export async function fetchProjectAlertRules(): Promise<AlertRuleRow[]> {
  const res = await dashboardApiFetch("/api/project/alert-rules");
  if (!res.ok) return [];
  try {
    const data = (await res.json()) as { rules?: unknown };
    if (!Array.isArray(data.rules)) return [];
    return data.rules.filter(isAlertRuleRow);
  } catch {
    return [];
  }
}
