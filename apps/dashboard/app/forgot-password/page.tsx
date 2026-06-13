import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return (
    <div className="auth-page">
      <div className="auth-page__panel card">
        <h1 className="auth-page__title">Reset password</h1>
        <p className="auth-page__lede">
          Enter your account email. If it exists, we will create a reset link (shown here in
          development; email in production when configured).
        </p>
        <ForgotPasswordForm />
        <p className="auth-page__hint text-muted-foreground">
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
