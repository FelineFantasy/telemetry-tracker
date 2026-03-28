"use client";

import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { ErrorPageShell } from "@/app/components/error-pages/ErrorPageShell";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * Root-level error UI when the root layout fails. Must define html/body (replaces root layout).
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/global-error
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ErrorPageShell
          code="ROOT LAYOUT"
          eyebrow="Fatal · shell"
          title="Hard stop—we never left the hangar"
          description={
            <>
              The root layout failed, so no routes could mount. This one&apos;s on us or the build—not
              your data. Reload the page; if the sky stays dark, check the console and redeploy.
            </>
          }
          footer={
            process.env.NODE_ENV === "development" && error.message ? (
              <pre className="mx-auto max-h-36 max-w-full overflow-auto rounded-lg border border-border bg-code-bg p-3 text-left font-mono text-[11px] leading-relaxed text-code-foreground">
                {error.message}
              </pre>
            ) : null
          }
        >
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-white/10 bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-inner-soft transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={() => reset()}
          >
            Reload app
          </button>
        </ErrorPageShell>
      </body>
    </html>
  );
}
