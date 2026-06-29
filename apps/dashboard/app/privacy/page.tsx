import type { Metadata } from "next";
import { PrivacyPageContent } from "@/app/components/marketing/privacy/PrivacyPageContent";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Telemetry Tracker handles personal data when you self-host — written for humans, not lawyers.",
  openGraph: {
    title: "Privacy Policy — Telemetry Tracker",
    description:
      "What the product can process, where it lives when self-hosted, and the controls you have.",
  },
};

export default function PrivacyPage() {
  return <PrivacyPageContent />;
}
