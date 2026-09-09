import type { Metadata } from "next";
import { DocsHomePage } from "@/app/components/docs/DocsHomePage";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Install an SDK, capture your first event, and ship reliable software with Telemetry Tracker. Quickstarts, guides, and ingest reference.",
  alternates: { canonical: "./" },
  openGraph: {
    title: "Documentation — Telemetry Tracker",
    description:
      "Quickstarts, SDK guides, and ingest reference for the Telemetry Tracker observability platform.",
  },
};

export default function DocsPage() {
  return <DocsHomePage />;
}
