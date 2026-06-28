"use client";

import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { login } from "@/app/auth/actions";
import { LegalExternalLink } from "@/app/components/legal/LegalPageShell";
import { Button } from "@/app/components/ui/Button";
import { PasswordInput } from "@/app/components/ui/PasswordInput";
import Link from "next/link";

export function LoginForm({
  onSwitchToSignUp,
  inModal = false,
}: {
  onSwitchToSignUp?: () => void;
  inModal?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next")?.startsWith("/")
    ? searchParams.get("next")!
    : "/dashboard/overview";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const r = await login(formData);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  const ForgotPasswordLink = inModal ? (
    <LegalExternalLink href="/forgot-password">Forgot password?</LegalExternalLink>
  ) : (
    <Link href="/forgot-password">Forgot password?</Link>
  );

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <label className="auth-form__label" htmlFor="login-email">
        Email
      </label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        className="filter-input auth-form__input"
        disabled={pending}
      />
      <label className="auth-form__label" htmlFor="login-password">
        Password
      </label>
      <PasswordInput
        id="login-password"
        name="password"
        autoComplete="current-password"
        required
        disabled={pending}
      />
      {error ? (
        <p className="auth-form__error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending} className="auth-form__submit">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="auth-form__footer">
        {onSwitchToSignUp ? (
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-link"
            onClick={onSwitchToSignUp}
          >
            Create an account
          </button>
        ) : (
          <Link href="/register">Create an account</Link>
        )}
        {" · "}
        {ForgotPasswordLink}
      </p>
      {inModal ? (
        <p className="text-center text-xs text-muted-foreground">
          By signing in you agree to our{" "}
          <LegalExternalLink href="/terms">Terms</LegalExternalLink> and{" "}
          <LegalExternalLink href="/privacy">Privacy Policy</LegalExternalLink>.
        </p>
      ) : null}
    </form>
  );
}
