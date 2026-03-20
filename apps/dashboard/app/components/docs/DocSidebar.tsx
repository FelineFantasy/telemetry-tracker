"use client";

import { usePathname } from "next/navigation";
import { SidebarBrand } from "@/app/components/sidebar/SidebarBrand";
import { useMobileDrawer } from "@/lib/useMobileDrawer";
import { SidebarLink } from "@/app/components/dashboard/SidebarLink";

const docLinks = [
  { href: "/docs", label: "Introduction", mono: "In" },
  { href: "/docs/nextjs", label: "Next.js", mono: "Nx" },
  { href: "/docs/nuxt", label: "Nuxt", mono: "Nu" },
  { href: "/docs/node", label: "Node.js", mono: "No" },
  { href: "/docs/react-native", label: "React Native", mono: "RN" },
] as const;

function isDocCurrent(href: string, pathname: string): boolean {
  if (href === "/docs") {
    return pathname === "/docs" || pathname === "/docs/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DocSidebar({
  isOpen = false,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const isMobileDrawer = useMobileDrawer();

  const handleNav = () => {
    onClose?.();
  };

  const inertOffCanvas = isMobileDrawer && !isOpen;

  const asideClass = ["app-sidebar", "docs-sidebar", isOpen ? "app-sidebar--open" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <aside
      className={asideClass}
      aria-label="Documentation"
      inert={inertOffCanvas ? true : undefined}
    >
      <SidebarBrand
        onNavigate={handleNav}
        onClose={onClose}
        showDrawerClose={isMobileDrawer}
        closeAriaLabel="Close documentation menu"
      />

      <div className="app-sidebar__section app-sidebar__section--views">
        <div className="app-sidebar__head">
          <h2 className="app-sidebar__title">
            <span className="app-sidebar__title-full">Guides</span>
            <span className="app-sidebar__title-short" aria-hidden>
              G
            </span>
          </h2>
        </div>
        <nav className="app-sidebar__nav" aria-label="Documentation pages">
          {docLinks.map(({ href, label, mono }) => (
            <SidebarLink
              key={href}
              href={href}
              label={label}
              mono={mono}
              current={isDocCurrent(href, pathname)}
              onNavigate={handleNav}
              title={label}
            />
          ))}
        </nav>
      </div>

      <div className="app-sidebar__rail-footer">
        <nav className="app-sidebar__footer" aria-label="Application">
          <SidebarLink
            href="/dashboard/overview"
            label="Dashboard"
            mono="Db"
            onNavigate={handleNav}
            title="Open dashboard"
            className="app-sidebar__link--footer"
          />
        </nav>
      </div>
    </aside>
  );
}
