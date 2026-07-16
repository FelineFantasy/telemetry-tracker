"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  TelemetryProvider,
  useTrackPage,
} from "@telemetry-tracker/next";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";
import {
  getProductTelemetryConfig,
  shouldTrackProductTelemetry,
} from "@/lib/product-telemetry";

type ProductTelemetryProps = {
  serverChoice: CookieConsentChoice | null;
};

function TrackPage() {
  const pathname = usePathname();
  useTrackPage(pathname ?? "/");
  return null;
}

/** Dogfoods @telemetry-tracker/next for visits, sessions, and browser errors when env is set. */
export function ProductTelemetry({ serverChoice }: ProductTelemetryProps) {
  const pathname = usePathname();
  const [consentAccepted, setConsentAccepted] = useState(serverChoice === "accepted");
  const config = useMemo(() => getProductTelemetryConfig(), []);
  const shouldTrack = Boolean(
    config && shouldTrackProductTelemetry(pathname, consentAccepted)
  );

  useEffect(() => {
    setConsentAccepted(serverChoice === "accepted");

    function onConsentChanged(event: Event) {
      const detail = (event as CustomEvent<CookieConsentChoice>).detail;
      setConsentAccepted(detail === "accepted");
    }

    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, onConsentChanged);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, onConsentChanged);
  }, [serverChoice]);

  if (!shouldTrack || !config) return null;

  return (
    <TelemetryProvider config={config}>
      <TrackPage />
    </TelemetryProvider>
  );
}
