"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { clearPreferenceCookiesAction } from "@/app/cookie-consent/actions";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  cookieConsentDocumentCookie,
  isCookieConsentChoice,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    try {
      const value = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      if (isCookieConsentChoice(value)) {
        document.cookie = cookieConsentDocumentCookie(value);
        setVisible(false);
        return;
      }
      setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function decide(choice: CookieConsentChoice) {
    try {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);
      document.cookie = cookieConsentDocumentCookie(choice);
    } catch {
      /* ignore */
    }
    if (choice === "rejected") {
      startTransition(() => {
        void clearPreferenceCookiesAction();
      });
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4 sm:pb-6"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-surface/90 p-4 backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              aria-hidden
              className="mt-0.5 h-2 w-2 shrink-0 animate-pulse-dot rounded-full bg-brand"
            />
            <p className="text-sm leading-relaxed text-muted-foreground">
              We use a minimal set of cookies to keep the product running. Read our{" "}
              <Link
                href="/cookies"
                className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
              >
                cookie policy
              </Link>
              .
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => decide("rejected")}
              className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-elevated"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => decide("accepted")}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
