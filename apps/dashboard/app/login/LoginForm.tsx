"use client";

import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { login } from "@/app/auth/actions";
import { Button } from "@/app/components/ui/Button";
import Link from "next/link";

export function LoginForm() {
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
      <input
        id="login-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="filter-input auth-form__input"
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
        <Link href="/register">Create an account</Link>
      </p>
    </form>
  );
}
