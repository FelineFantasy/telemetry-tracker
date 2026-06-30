"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/auth/actions";
import {
  AuthSubmitButton,
  authInputCls,
} from "@/app/components/auth/AuthPageShell";
import { PasswordInput } from "@/app/components/ui/PasswordInput";

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
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label
          htmlFor="reset-password"
          className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-muted-foreground"
        >
          New password
        </label>
        <PasswordInput
          id="reset-password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
          className={authInputCls}
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <AuthSubmitButton pending={pending}>
        {pending ? "Updating…" : "Update password"}
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
