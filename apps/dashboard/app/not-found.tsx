import type { Metadata } from "next";
import Link from "next/link";
import { ErrorPageShell } from "@/app/components/error-pages/ErrorPageShell";
import { ButtonLink } from "@/app/components/ui/Button";

export const metadata: Metadata = {
  title: "Nothing here — Telemetry Tracker",
};

export default function NotFound() {
  return (
    <div id="main-content">
      <ErrorPageShell
        code="HTTP 404"
        eyebrow="No matching route"
        title="This path has zero telemetry"
        description={
          <>
            We scanned the route table—crickets. Wrong URL, a stale bookmark, or a typo sneaked in. The
            rest of the product is happily emitting events; this address just isn&apos;t one of them.
          </>
        }
        footer={
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
            Ship faster with the{" "}
            <Link href="/docs" className="text-link font-medium text-primary hover:text-primary-hover">
              SDK docs
            </Link>
            —or head home and plot a new course.
          </p>
        }
      >
        <ButtonLink href="/">Back to launch</ButtonLink>
        <ButtonLink href="/dashboard/overview" variant="secondary">
          Open dashboard
        </ButtonLink>
      </ErrorPageShell>
    </div>
  );
}
