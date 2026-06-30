"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type MarketingNavLinkProps = Omit<ComponentProps<typeof Link>, "children"> & {
  children: ReactNode;
  pendingLabel?: string;
};

export function MarketingNavLink({
  children,
  className,
  href,
  pendingLabel,
  onClick,
  ...props
}: MarketingNavLinkProps) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const targetPath = typeof href === "string" ? href.split(/[?#]/)[0] : null;

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  return (
    <Link
      href={href}
      className={cn(className, pending && "pointer-events-none opacity-80")}
      aria-busy={pending}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (targetPath && targetPath !== pathname) {
          setPending(true);
        }
      }}
      {...props}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          <span>{pendingLabel ?? "Loading…"}</span>
        </span>
      ) : (
        children
      )}
    </Link>
  );
}
