"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";
import { getGoogleAnalyticsMeasurementId } from "@/lib/google-analytics";

type GoogleAnalyticsProps = {
  serverChoice: CookieConsentChoice | null;
};

export function GoogleAnalytics({ serverChoice }: GoogleAnalyticsProps) {
  const measurementId = getGoogleAnalyticsMeasurementId();
  const [consentAccepted, setConsentAccepted] = useState(serverChoice === "accepted");

  useEffect(() => {
    setConsentAccepted(serverChoice === "accepted");

    function onConsentChanged(event: Event) {
      const detail = (event as CustomEvent<CookieConsentChoice>).detail;
      setConsentAccepted(detail === "accepted");
    }

    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, onConsentChanged);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, onConsentChanged);
  }, [serverChoice]);

  if (!measurementId || !consentAccepted) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
