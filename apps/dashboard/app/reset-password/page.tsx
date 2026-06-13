import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose new password",
  robots: { index: false, follow: true },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const trimmed = typeof token === "string" ? token.trim() : "";

  return (
    <div className="auth-page">
      <div className="auth-page__panel card">
        <h1 className="auth-page__title">Choose a new password</h1>
        {!trimmed ? (
          <p className="auth-form__error" role="alert">
            Missing reset token. Request a new link from{" "}
            <Link href="/forgot-password">forgot password</Link>.
          </p>
        ) : (
          <ResetPasswordForm token={trimmed} />
        )}
        <p className="auth-page__hint text-muted-foreground">
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
