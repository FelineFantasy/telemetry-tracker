"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";
import {
  AuthField,
  AuthSubmitButton,
} from "@/app/components/auth/AuthPageShell";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("email", email.trim());
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
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <AuthField
        id="forgot-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        placeholder="you@company.com"
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {devResetUrl ? (
        <p className="break-all text-sm">
          Dev reset link:{" "}
          <Link href={devResetUrl} className="text-primary underline">
            {devResetUrl}
          </Link>
        </p>
      ) : null}

      <AuthSubmitButton pending={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </AuthSubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
