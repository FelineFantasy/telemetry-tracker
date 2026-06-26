"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/auth/actions";
import { Button } from "@/app/components/ui/Button";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("token", token);
    setError(null);
    startTransition(async () => {
      const r = await resetPassword(formData);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <label className="auth-form__label" htmlFor="reset-password">
        New password
      </label>
      <input
        id="reset-password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        className="filter-input auth-form__input"
        disabled={pending}
      />
      {error ? (
        <p className="auth-form__error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending} className="auth-form__submit">
        {pending ? "Updating…" : "Update password"}
      </Button>
      <p className="auth-form__footer">
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  );
}
