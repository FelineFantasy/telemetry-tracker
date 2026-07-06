"use client";

import Link from "next/link";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeMenuLink({ onClick }: { onClick?: () => void }) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const active = theme ?? "dark";
  const resolved = resolvedTheme ?? "dark";
  const Icon = active === "system" ? Monitor : resolved === "light" ? Sun : Moon;
  const label =
    active === "system"
      ? `Theme · System (${resolved})`
      : `Theme · ${resolved === "light" ? "Light" : "Dark"}`;

  return (
    <Link
      href="/dashboard/settings/appearance"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-surface"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="flex-1">{mounted ? label : "Theme"}</span>
    </Link>
  );
}
