"use client";

import Link from "next/link";
import { SidebarCloseIcon } from "./SidebarCloseIcon";

/**
 * Telemetry Tracker brand row. On mobile drawer, shows a subtle close control beside the title.
 */
export function SidebarBrand({
  onNavigate,
  onClose,
  showDrawerClose,
  closeAriaLabel,
}: {
  onNavigate?: () => void;
  onClose?: () => void;
  showDrawerClose: boolean;
  closeAriaLabel: string;
}) {
  return (
    <div className="app-sidebar__brand app-sidebar__brand--with-close">
      <Link
        href="/"
        className="app-sidebar__brand-link"
        onClick={onNavigate}
        title="Telemetry Tracker — Home"
      >
        <span className="app-sidebar__brand-full">Telemetry Tracker</span>
        <span className="app-sidebar__brand-short" aria-hidden>
          T
        </span>
      </Link>
      {showDrawerClose && onClose ? (
        <button
          type="button"
          className="sidebar-drawer-close"
          onClick={onClose}
          aria-label={closeAriaLabel}
        >
          <SidebarCloseIcon />
        </button>
      ) : null}
    </div>
  );
}
