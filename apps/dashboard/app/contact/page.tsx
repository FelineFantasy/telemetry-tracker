import type { Metadata } from "next";
import { ContactPageContent } from "@/app/components/marketing/contact/ContactPageContent";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the Telemetry Tracker team. Support, security, business inquiries, and self-hosting questions.",
  openGraph: {
    title: "Contact — Telemetry Tracker",
    description:
      "Reach the Telemetry Tracker team for support, security disclosures, and self-hosting questions.",
  },
};

export default function ContactPage() {
  return <ContactPageContent />;
}
