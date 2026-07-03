"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";
import { isMarketingAnalyticsPath } from "@/lib/google-analytics";

type GoogleAnalyticsProps = {
  measurementId: string | null;
  serverChoice: CookieConsentChoice | null;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function GoogleAnalytics({ measurementId, serverChoice }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const [consentAccepted, setConsentAccepted] = useState(serverChoice === "accepted");
  const [gtagReady, setGtagReady] = useState(false);
  const shouldTrack = Boolean(
    measurementId && consentAccepted && isMarketingAnalyticsPath(pathname)
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

  useEffect(() => {
    if (!gtagReady || !shouldTrack || !measurementId || !pathname) return;
    window.gtag?.("config", measurementId, { page_path: pathname });
  }, [gtagReady, shouldTrack, measurementId, pathname]);

  useEffect(() => {
    if (!consentAccepted) {
      setGtagReady(false);
      return;
    }
    if (shouldTrack && typeof window.gtag === "function") {
      setGtagReady(true);
    }
  }, [consentAccepted, shouldTrack]);

  if (!shouldTrack) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        onReady={() => setGtagReady(true)}
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
        `}
      </Script>
    </>
  );
}
