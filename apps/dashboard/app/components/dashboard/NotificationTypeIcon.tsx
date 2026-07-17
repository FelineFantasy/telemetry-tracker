import {
  AlertTriangle,
  Bell,
  BellRing,
  CreditCard,
  Users,
  Zap,
} from "lucide-react";
import type { DashboardNotificationItem } from "@/lib/dashboard-notifications";

export function NotificationTypeIcon({
  type,
  className = "h-3.5 w-3.5",
}: {
  type: DashboardNotificationItem["type"];
  className?: string;
}) {
  switch (type) {
    case "issue":
      return <AlertTriangle className={`${className} text-destructive`} />;
    case "billing":
      return <CreditCard className={`${className} text-warning`} />;
    case "quota":
      return <Zap className={`${className} text-warning`} />;
    case "team":
      return <Users className={`${className} text-brand`} />;
    case "alert":
      return <BellRing className={`${className} text-warning`} />;
    default:
      return <Bell className={`${className} text-brand`} />;
  }
}

export const NOTIFICATION_TYPE_LABELS: Record<
  DashboardNotificationItem["type"],
  string
> = {
  issue: "Issues",
  billing: "Billing",
  quota: "Quota",
  team: "Team",
  alert: "Alerts",
};
