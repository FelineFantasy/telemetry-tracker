import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageShell } from "@/app/components/auth/AuthPageShell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell mode="forgot-password">
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="/"
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
        >
          ← Back to home
        </Link>
      </p>
    </AuthPageShell>
  );
}
