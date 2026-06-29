import type { Metadata } from "next";
import { TermsPageContent } from "@/app/components/marketing/terms/TermsPageContent";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern your use of Telemetry Tracker — accounts, acceptable use, data, billing, and liability.",
  openGraph: {
    title: "Terms of Service — Telemetry Tracker",
    description:
      "Plain-English terms covering accounts, acceptable use, customer data, billing, and liability.",
  },
};

export default function TermsPage() {
  return <TermsPageContent />;
}
