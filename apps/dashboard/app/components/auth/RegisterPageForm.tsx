"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { register } from "@/app/auth/actions";
import { LegalExternalLink } from "@/app/components/legal/LegalPageShell";
import {
  AuthField,
  AuthPageShell,
  authInputCls,
} from "@/app/components/auth/AuthPageShell";
import { PasswordInput } from "@/app/components/ui/PasswordInput";
import {
  fieldErrorsFromZod,
  registerPageSchema,
  type RegisterPageValues,
} from "@/lib/auth-schemas";

export function RegisterPageForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() ?? "";

  const [values, setValues] = useState<RegisterPageValues>({
    name: "",
    email: "",
    password: "",
    confirm: "",
    termsAccepted: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterPageValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof RegisterPageValues>(key: K, val: RegisterPageValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    if (formError) setFormError(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = registerPageSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod(parsed.error.issues));
      return;
    }

    setErrors({});
    setFormError(null);
    const formData = new FormData();
    formData.set("email", parsed.data.email);
    formData.set("password", parsed.data.password);
    formData.set("displayName", parsed.data.name);
    if (inviteToken) formData.set("inviteToken", inviteToken);

    startTransition(async () => {
      const result = await register(formData);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      router.push(
        inviteToken ? "/dashboard/overview" : "/dashboard/settings/organization",
      );
      router.refresh();
    });
  }

  return (
    <AuthPageShell mode="register">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <AuthField
          id="register-name"
          label="Full name"
          autoComplete="name"
          value={values.name}
          onChange={(v) => update("name", v)}
          error={errors.name}
          placeholder="Ada Lovelace"
        />
        <AuthField
          id="register-email"
          label="Work email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(v) => update("email", v)}
          error={errors.email}
          placeholder="you@company.com"
        />
        <div>
          <label
            htmlFor="register-password"
            className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-muted-foreground"
          >
            Password
          </label>
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="At least 8 characters"
            disabled={pending}
            className={authInputCls}
            aria-invalid={!!errors.password}
          />
          {errors.password ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.password}</p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="register-confirm"
            className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-muted-foreground"
          >
            Confirm password
          </label>
          <PasswordInput
            id="register-confirm"
            autoComplete="new-password"
            value={values.confirm}
            onChange={(e) => update("confirm", e.target.value)}
            placeholder="Repeat password"
            disabled={pending}
            className={authInputCls}
            aria-invalid={!!errors.confirm}
          />
          {errors.confirm ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.confirm}</p>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/50 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            checked={values.termsAccepted}
            onChange={(e) => update("termsAccepted", e.target.checked)}
            disabled={pending}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-brand"
          />
          <span>
            I agree to the{" "}
            <LegalExternalLink href="/terms">Terms of Service</LegalExternalLink> and{" "}
            <LegalExternalLink href="/privacy">Privacy Policy</LegalExternalLink>.
          </span>
        </label>
        {errors.termsAccepted ? (
          <p className="-mt-2 text-xs text-destructive">{errors.termsAccepted}</p>
        ) : null}

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
          {pending ? "Creating account…" : "Create account"}
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
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthPageShell>
  );
}
