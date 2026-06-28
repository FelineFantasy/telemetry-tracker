import type { ReactNode } from "react";
import { CONTACT_EMAIL, GMAIL_COMPOSE_URL } from "@/lib/contact-email";

export function ContactEmailLink({
  className = "text-brand hover:underline",
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <a href={GMAIL_COMPOSE_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {children ?? CONTACT_EMAIL}
    </a>
  );
}
