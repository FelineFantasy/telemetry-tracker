"use client";

import { usePathname } from "next/navigation";
import { SidebarBrand } from "@/app/components/sidebar/SidebarBrand";
import { useMobileDrawer } from "@/lib/useMobileDrawer";
import { SidebarLink } from "@/app/components/dashboard/SidebarLink";

function isDocCurrent(href: string, pathname: string): boolean {
  if (href === "/docs") {
    return pathname === "/docs" || pathname === "/docs/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function GroupLabel({ children }: { children: string }) {
  return <p className="docs-sidebar__group-label">{children}</p>;
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
        <nav className="app-sidebar__nav docs-sidebar__nav" aria-label="Documentation pages">
          <GroupLabel>Getting Started</GroupLabel>
          <SidebarLink
            href="/docs"
            label="Getting Started"
            mono="GS"
            current={isDocCurrent("/docs", pathname)}
            onNavigate={handleNav}
            title="Getting started"
          />

          <GroupLabel>SDK</GroupLabel>
          <SidebarLink
            href="/docs/sdk"
            label="SDK"
            mono="Sdk"
            current={isDocCurrent("/docs/sdk", pathname)}
            onNavigate={handleNav}
            title="SDK reference"
          />

          <GroupLabel>Platforms</GroupLabel>
          <SidebarLink
            href="/docs/nextjs"
            label="Next.js"
            mono="Nx"
            current={isDocCurrent("/docs/nextjs", pathname)}
            onNavigate={handleNav}
            title="Next.js"
          />
          <SidebarLink
            href="/docs/nuxt"
            label="Nuxt"
            mono="Nu"
            current={isDocCurrent("/docs/nuxt", pathname)}
            onNavigate={handleNav}
            title="Nuxt"
          />
          <SidebarLink
            href="/docs/node"
            label="Node.js"
            mono="No"
            current={isDocCurrent("/docs/node", pathname)}
            onNavigate={handleNav}
            title="Node.js"
          />
          <SidebarLink
            href="/docs/react-native"
            label="React Native"
            mono="RN"
            current={isDocCurrent("/docs/react-native", pathname)}
            onNavigate={handleNav}
            title="React Native"
          />

          <GroupLabel>Dashboard</GroupLabel>
          <SidebarLink
            href="/docs/dashboard"
            label="Using the dashboard"
            mono="Ui"
            current={isDocCurrent("/docs/dashboard", pathname)}
            onNavigate={handleNav}
            title="Using the dashboard"
          />
        </nav>
      </div>

      <div className="app-sidebar__rail-footer">
        <nav className="app-sidebar__footer" aria-label="Application">
          <SidebarLink
            href="/dashboard/overview"
            label="Open app"
            mono="Db"
            onNavigate={handleNav}
            title="Open Telemetry Tracker dashboard"
            className="app-sidebar__link--footer"
          />
        </nav>
      </div>
    </aside>
  );
}
