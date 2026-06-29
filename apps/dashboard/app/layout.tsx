import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { CookieConsent } from "@/app/components/marketing/cookie-consent";
import { ToasterProvider } from "@/app/components/ToasterProvider";
import { getCookieConsentChoiceFromCookies } from "@/lib/cookie-consent-server";
import { socialPreviewImage } from "@/lib/social-image";
import { resolveMetadataBase } from "@/lib/site-url";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

const defaultTitle =
  "Telemetry Tracker — Observability for teams that ship";
const defaultDescription =
  "Capture errors, events and sessions with lightweight SDKs. One fast, developer-first observability platform for modern applications.";

const metadataBase = resolveMetadataBase() ?? new URL("http://localhost:3000");

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: defaultTitle,
    template: "%s · Telemetry Tracker",
  },
  description: defaultDescription,
  applicationName: "Telemetry Tracker",
  keywords: [
    "self-hosted telemetry",
    "error tracking",
    "session monitoring",
    "product analytics",
    "Next.js",
    "open source",
    "SDK",
  ],
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Telemetry Tracker",
    title: defaultTitle,
    description: defaultDescription,
    images: [socialPreviewImage],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [socialPreviewImage.url],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const serverChoice = await getCookieConsentChoiceFromCookies();
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ToasterProvider />
        {children}
        <CookieConsent serverChoice={serverChoice} />
      </body>
    </html>
  );
}
