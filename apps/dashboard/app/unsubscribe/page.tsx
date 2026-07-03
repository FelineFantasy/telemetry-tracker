import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribePageContent } from "@/app/components/marketing/unsubscribe/UnsubscribePageContent";

export const metadata: Metadata = {
  title: "Unsubscribe — Telemetry Tracker",
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribePageContent />
    </Suspense>
  );
}
