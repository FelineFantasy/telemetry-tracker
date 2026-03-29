"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { register } from "@/app/auth/actions";
import { Button } from "@/app/components/ui/Button";
import Link from "next/link";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const r = await register(formData);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/dashboard/overview");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <label className="auth-form__label" htmlFor="reg-email">
        Email
      </label>
      <input
        id="reg-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        className="filter-input auth-form__input"
        disabled={pending}
      />
      <label className="auth-form__label" htmlFor="reg-name">
        Display name <span className="text-muted-foreground">(optional)</span>
      </label>
      <input
        id="reg-name"
        name="displayName"
        type="text"
        autoComplete="name"
        className="filter-input auth-form__input"
        disabled={pending}
        maxLength={120}
      />
      <label className="auth-form__label" htmlFor="reg-password">
        Password
      </label>
      <input
        id="reg-password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        className="filter-input auth-form__input"
        disabled={pending}
      />
      <p className="auth-form__hint text-muted-foreground">At least 8 characters.</p>
      {error ? (
        <p className="auth-form__error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending} className="auth-form__submit">
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="auth-form__footer">
        <Link href="/login">Already have an account?</Link>
      </p>
    </form>
  );
}
