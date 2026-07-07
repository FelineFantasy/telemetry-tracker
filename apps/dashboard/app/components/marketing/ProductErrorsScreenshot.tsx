import { ThemeAwareScreenshot } from "@/app/components/marketing/ThemeAwareScreenshot";

const ALT =
  "Telemetry Tracker errors page with KPIs, trends chart, top error types, and grouped error table";

export function ProductErrorsScreenshot() {
  return (
    <ThemeAwareScreenshot
      lightSrc="/screenshot-errors-light.png"
      darkSrc="/screenshot-errors-dark.png"
      alt={ALT}
      loading="lazy"
    />
  );
}
