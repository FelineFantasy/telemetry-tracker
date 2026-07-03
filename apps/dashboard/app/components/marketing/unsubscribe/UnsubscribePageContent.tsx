"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { unsubscribeFromProductUpdates } from "@/app/marketing/actions";
import { Footer } from "@/app/components/marketing/footer";
import { Nav } from "@/app/components/marketing/nav";

export function UnsubscribePageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing unsubscribe link. Use the link from your email or contact support.");
      return;
    }

    let cancelled = false;
    void unsubscribeFromProductUpdates(token).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setStatus("error");
        setMessage(result.error);
        return;
      }
      setStatus("ok");
      setMessage(result.message);
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main id="main-content" className="mx-auto max-w-lg px-6 pt-32 pb-20">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Email preferences</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Unsubscribe</h1>
        <div className="mt-6 rounded-2xl border border-border bg-surface/40 p-6 text-sm leading-relaxed text-muted-foreground">
          {status === "loading" ? <p>Processing your request…</p> : null}
          {status !== "loading" ? (
            <p className={status === "error" ? "text-destructive" : "text-foreground"}>{message}</p>
          ) : null}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Changed your mind?{" "}
          <Link href="/contact" className="text-foreground underline-offset-4 hover:underline">
            Contact us
          </Link>{" "}
          or subscribe again from the{" "}
          <Link href="/" className="text-foreground underline-offset-4 hover:underline">
            homepage footer
          </Link>
          .
        </p>
      </main>
      <Footer />
    </div>
  );
}
