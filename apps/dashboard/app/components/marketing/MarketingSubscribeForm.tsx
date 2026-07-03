"use client";

import { useState, type FormEvent } from "react";
import { subscribeToProductUpdates } from "@/app/marketing/actions";
import { authInputClassName } from "@/lib/input-classes";

type MarketingSubscribeFormProps = {
  compact?: boolean;
  idPrefix?: string;
};

export function MarketingSubscribeForm({
  compact = false,
  idPrefix = "marketing",
}: MarketingSubscribeFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email");
      return;
    }
    setPending(true);
    const result = await subscribeToProductUpdates(trimmed);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(result.message);
    setEmail("");
  }

  return (
    <div className={compact ? "" : "rounded-2xl border border-border bg-surface/40 p-5"}>
      {!compact ? (
        <p className="text-sm font-medium text-foreground">Product updates</p>
      ) : null}
      <p className={`text-sm text-muted-foreground ${compact ? "mt-0" : "mt-1"}`}>
        Release notes and feature announcements. Unsubscribe anytime.
      </p>
      <form onSubmit={onSubmit} className={`flex ${compact ? "mt-3 flex-col gap-2 sm:flex-row" : "mt-4 flex-col gap-2 sm:flex-row"}`} noValidate>
        <label htmlFor={`${idPrefix}-email`} className="sr-only">
          Email for product updates
        </label>
        <input
          id={`${idPrefix}-email`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
            if (success) setSuccess(null);
          }}
          placeholder="you@company.com"
          disabled={pending}
          className={`min-w-0 flex-1 ${authInputClassName}`}
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Subscribing…" : "Subscribe"}
        </button>
      </form>
      {error ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-2 text-xs text-success" role="status">
          {success}
        </p>
      ) : null}
    </div>
  );
}
