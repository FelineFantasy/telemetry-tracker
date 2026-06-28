"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  Suspense,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { LoginForm } from "@/app/components/auth/LoginForm";
import { RegisterForm } from "@/app/components/auth/RegisterForm";
import { Logo } from "./logo";

type AuthModalsContextValue = {
  openSignIn: () => void;
  openSignUp: (opts?: { inviteToken?: string }) => void;
  closeModals: () => void;
};

const AuthModalsContext = createContext<AuthModalsContextValue | null>(null);

export function useAuthModals() {
  const ctx = useContext(AuthModalsContext);
  if (!ctx) {
    throw new Error("useAuthModals must be used within AuthModalProvider");
  }
  return ctx;
}

function AuthModalMark() {
  return (
    <div
      aria-hidden
      className="grid h-12 w-12 place-items-center rounded-xl border border-border-strong bg-surface shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
    >
      <svg
        viewBox="0 0 16 16"
        className="h-6 w-6 text-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 9 L4 9 L6 3 L10 13 L12 7 L15 7" />
      </svg>
    </div>
  );
}

function AuthModalShell({
  open,
  onClose,
  titleId,
  eyebrow,
  title,
  description,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  eyebrow: string;
  title: string;
  description: string;
  closeLabel: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0 bg-background/70 backdrop-blur-md"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border-strong bg-surface/95 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden className="glow-blue pointer-events-none absolute inset-x-0 top-0 h-40 opacity-70" />
        <div
          aria-hidden
          className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-40 opacity-[0.2] [mask-image:linear-gradient(to_bottom,#000,transparent)]"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:bg-surface hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative max-h-[min(90vh,760px)] overflow-y-auto px-6 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
          <div className="flex flex-col items-center text-center">
            <AuthModalMark />
            <p className="mt-5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </p>
            <h2 id={titleId} className="mt-2 text-2xl font-semibold tracking-tight">
              {title}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
            <div className="mt-5">
              <Logo />
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

function AuthModalUrlHandler({
  showSignIn,
  showSignUp,
  closeModalState,
}: {
  showSignIn: () => void;
  showSignUp: (opts?: { inviteToken?: string }) => void;
  closeModalState: () => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const invite = searchParams.get("invite");
    if (searchParams.get("signUp") === "1") {
      showSignUp(invite ? { inviteToken: invite } : undefined);
      return;
    }
    if (searchParams.get("signIn") === "1") {
      showSignIn();
      return;
    }
    closeModalState();
  }, [searchParams, showSignIn, showSignUp, closeModalState]);

  return null;
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [signInOpen, setSignInOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState("");

  const replaceAuthParams = useCallback(
    (mode: "closed" | "signIn" | "signUp", invite?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const preservedInvite = params.get("invite");
      params.delete("signIn");
      params.delete("signUp");
      if (mode === "signIn") {
        params.delete("invite");
        params.set("signIn", "1");
      } else if (mode === "signUp") {
        params.delete("invite");
        params.set("signUp", "1");
        if (invite) params.set("invite", invite);
      } else {
        if (preservedInvite) params.set("invite", preservedInvite);
        else params.delete("invite");
      }
      const q = params.toString();
      const next = q ? `${pathname}?${q}` : pathname;
      const currentQ = searchParams.toString();
      const current = currentQ ? `${pathname}?${currentQ}` : pathname;
      if (next !== current) {
        router.replace(next, { scroll: false });
      }
    },
    [pathname, router, searchParams],
  );

  const closeModalState = useCallback(() => {
    setSignInOpen(false);
    setSignUpOpen(false);
  }, []);

  const clearAuthParams = useCallback(() => {
    replaceAuthParams("closed");
  }, [replaceAuthParams]);

  const closeModals = useCallback(() => {
    closeModalState();
    clearAuthParams();
  }, [clearAuthParams, closeModalState]);

  const completeAuth = useCallback(
    (destination: string) => {
      closeModalState();
      router.push(destination);
      router.refresh();
    },
    [closeModalState, router],
  );

  const showSignIn = useCallback(() => {
    setSignUpOpen(false);
    setInviteToken("");
    setSignInOpen(true);
  }, []);

  const showSignUp = useCallback((opts?: { inviteToken?: string }) => {
    setSignInOpen(false);
    setInviteToken(opts?.inviteToken ?? "");
    setSignUpOpen(true);
  }, []);

  const openSignIn = useCallback(() => {
    showSignIn();
    replaceAuthParams("signIn");
  }, [replaceAuthParams, showSignIn]);

  const openSignUp = useCallback(
    (opts?: { inviteToken?: string }) => {
      const token = opts?.inviteToken ?? searchParams.get("invite") ?? "";
      showSignUp({ inviteToken: token || undefined });
      replaceAuthParams("signUp", token || undefined);
    },
    [replaceAuthParams, searchParams, showSignUp],
  );

  const signUpDescription = inviteToken
    ? "Complete registration to join the organization you were invited to."
    : "Free to start. Set up your organization and API keys in minutes.";

  return (
    <AuthModalsContext value={{ openSignIn, openSignUp, closeModals }}>
      <Suspense fallback={null}>
        <AuthModalUrlHandler
          showSignIn={showSignIn}
          showSignUp={showSignUp}
          closeModalState={closeModalState}
        />
      </Suspense>
      {children}

      <AuthModalShell
        open={signInOpen}
        onClose={closeModals}
        titleId="sign-in-title"
        eyebrow="Welcome back"
        title="Sign in"
        description="Access your dashboard, organizations, and telemetry in one place."
        closeLabel="Close sign in"
      >
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <LoginForm onSwitchToSignUp={() => openSignUp()} onSuccess={completeAuth} />
        </Suspense>
      </AuthModalShell>

      <AuthModalShell
        open={signUpOpen}
        onClose={closeModals}
        titleId="sign-up-title"
        eyebrow="Get started"
        title="Create account"
        description={signUpDescription}
        closeLabel="Close create account"
      >
        <RegisterForm
          inviteToken={inviteToken}
          onSwitchToSignIn={openSignIn}
          onSuccess={completeAuth}
          requireTerms
        />
      </AuthModalShell>
    </AuthModalsContext>
  );
}

export function SignUpButton({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"button">) {
  const { openSignUp } = useAuthModals();
  return (
    <button type="button" className={className} onClick={() => openSignUp()} {...props}>
      {children}
    </button>
  );
}
