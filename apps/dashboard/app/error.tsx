"use client";

import { useEffect } from "react";
import { ErrorPageShell } from "@/app/components/error-pages/ErrorPageShell";
import { Button, ButtonLink } from "@/app/components/ui/Button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error.digest;
  const codeLine = digest ? `TRACE ${digest.slice(0, 10)}…` : "RUNTIME";

  return (
    <div id="main-content">
      <ErrorPageShell
        code={codeLine}
        eyebrow="Render interrupted"
        title="The view crashed mid-flight"
        description={
          <>
            Something threw before we could paint this screen—think of it as a spike on the error graph.
            Retry usually smooths the curve; if it keeps spiking, grab the message below (in dev) and we
            can chase it down.
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
        <Button type="button" onClick={() => reset()}>
          Retry render
        </Button>
        <ButtonLink href="/dashboard/overview" variant="secondary">
          Mission control
        </ButtonLink>
      </ErrorPageShell>
    </div>
  );
}
