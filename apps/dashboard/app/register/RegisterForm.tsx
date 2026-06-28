"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { register } from "@/app/auth/actions";
import { LegalExternalLink } from "@/app/components/legal/LegalPageShell";
import { Button } from "@/app/components/ui/Button";
import { PasswordInput } from "@/app/components/ui/PasswordInput";
import Link from "next/link";

export function RegisterForm({
  inviteToken = "",
  onSwitchToSignIn,
  requireTerms = false,
}: {
  inviteToken?: string;
  onSwitchToSignIn?: () => void;
  requireTerms?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (requireTerms && !termsAccepted) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const r = await register(formData);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(
        inviteToken ? "/dashboard/overview" : "/dashboard/settings/organization",
      );
      router.refresh();
    });
  }

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 8 &&
    (!requireTerms || termsAccepted) &&
    !pending;

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}
      <label className="auth-form__label" htmlFor="reg-email">
        Email
      </label>
      <input
        id="reg-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
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
      <PasswordInput
        id="reg-password"
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={pending}
      />
      <p className="auth-form__hint text-muted-foreground">At least 8 characters.</p>

      {requireTerms ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/50 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            disabled={pending}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-brand"
          />
          <span>
            I agree to the{" "}
            <LegalExternalLink href="/terms">Terms of Service</LegalExternalLink> and{" "}
            <LegalExternalLink href="/privacy">Privacy Policy</LegalExternalLink>.
          </span>
        </label>
      ) : null}

      {error ? (
        <p className="auth-form__error" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        disabled={!canSubmit}
        className="auth-form__submit"
      >
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="auth-form__footer">
        {onSwitchToSignIn ? (
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-link"
            onClick={onSwitchToSignIn}
          >
            Already have an account?
          </button>
        ) : (
          <Link href="/login">Already have an account?</Link>
        )}
      </p>
    </form>
  );
}
