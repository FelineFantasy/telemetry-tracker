import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { ToasterProvider } from "@/app/components/ToasterProvider";
import { resolveMetadataBase } from "@/lib/site-url";
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

export const viewport: Viewport = {
  themeColor: "#674fdc",
};

const defaultTitle =
  "Telemetry Tracker — Self-hosted errors, events & sessions";
const defaultDescription =
  "Open-source, self-hosted telemetry: grouped errors with stacks, product events, session timelines, and SDKs for web, Next.js, Node, and React Native—without shipping data to a third-party APM.";

/** Prefer NEXT_PUBLIC_SITE_URL or RAILWAY_PUBLIC_DOMAIN; localhost only as a build-time fallback. */
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
    "session replay alternative",
    "product analytics",
    "Next.js",
    "open source",
    "SDK",
  ],
  manifest: "/site.webmanifest",
  icons: {
    icon: [
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
    images: [
      {
        url: "/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: "Telemetry Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ToasterProvider />
        {children}
      </body>
    </html>
  );
}
