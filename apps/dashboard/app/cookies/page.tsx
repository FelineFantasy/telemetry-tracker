import type { Metadata } from "next";
import { CookiesPageContent } from "@/app/components/marketing/cookies/CookiesPageContent";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "How Telemetry Tracker uses cookies and similar storage technologies, and how to control them.",
  openGraph: {
    title: "Cookie Policy — Telemetry Tracker",
    description: "A plain-English summary of the cookies and storage Telemetry Tracker uses.",
  },
};

export default function CookiesPage() {
  return <CookiesPageContent />;
}
