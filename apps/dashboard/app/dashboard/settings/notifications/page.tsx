import { NotificationsSettingsClient } from "./NotificationsSettingsClient";
import { fetchNotificationPreferences } from "@/lib/notification-preferences";

export default async function NotificationsSettingsPage() {
  const preferences = await fetchNotificationPreferences();
  return <NotificationsSettingsClient initialPreferences={preferences} />;
}
