import { ThemeAwareScreenshot } from "@/app/components/marketing/ThemeAwareScreenshot";

const ALT =
  "Telemetry Tracker overview with errors, events, sessions, performance metrics, and recent releases";

export function HeroDashboardScreenshot() {
  return (
    <ThemeAwareScreenshot
      lightSrc="/screenshot-dashboard-light.png"
      darkSrc="/screenshot-dashboard-dark.png"
      alt={ALT}
      priority
    />
  );
}
