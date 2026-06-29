"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { login } from "@/app/auth/actions";
import {
  AuthField,
  AuthPageShell,
  authInputCls,
} from "@/app/components/auth/AuthPageShell";
import { PasswordInput } from "@/app/components/ui/PasswordInput";
import {
  fieldErrorsFromZod,
  loginSchema,
  type LoginFormValues,
} from "@/lib/auth-schemas";

export function LoginPageForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next")?.startsWith("/")
    ? searchParams.get("next")!
    : "/dashboard/overview";

  const [values, setValues] = useState<LoginFormValues>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof LoginFormValues>(key: K, val: LoginFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    if (formError) setFormError(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod(parsed.error.issues));
      return;
    }

    setErrors({});
    setFormError(null);
    const formData = new FormData();
    formData.set("email", parsed.data.email);
    formData.set("password", parsed.data.password);

    startTransition(async () => {
      const result = await login(formData);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  return (
    <AuthPageShell mode="login">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <AuthField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(v) => update("email", v)}
          error={errors.email}
          placeholder="you@company.com"
        />
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="text-xs uppercase tracking-[0.14em] text-muted-foreground"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Forgot?
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            value={values.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="••••••••"
            disabled={pending}
            className={authInputCls}
            aria-invalid={!!errors.password}
          />
          {errors.password ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.password}</p>
          ) : null}
        </div>

        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>

        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href="/register"
            className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            Create an account
          </Link>
        </p>
      </form>
    </AuthPageShell>
  );
}
