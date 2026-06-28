"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";
import { Button } from "@/app/components/ui/Button";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setMessage(null);
    setDevResetUrl(null);
    startTransition(async () => {
      const r = await requestPasswordReset(formData);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMessage(r.message);
      if (r.resetUrl) setDevResetUrl(r.resetUrl);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <label className="auth-form__label" htmlFor="forgot-email">
        Email
      </label>
      <input
        id="forgot-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        className="filter-input auth-form__input"
        disabled={pending}
      />
      {error ? (
        <p className="auth-form__error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground m-0" role="status">
          {message}
        </p>
      ) : null}
      {devResetUrl ? (
        <p className="text-sm m-0 break-all">
          Dev reset link:{" "}
          <Link href={devResetUrl} className="text-primary underline">
            {devResetUrl}
          </Link>
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending} className="auth-form__submit">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="auth-form__footer">
        <Link href="/?signIn=1">Back to sign in</Link>
      </p>
    </form>
  );
}
