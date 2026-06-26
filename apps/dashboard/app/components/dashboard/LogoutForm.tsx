import { logoutAction } from "@/app/auth/actions";

function LogoutGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
      />
    </svg>
  );
}

export function LogoutForm({ railCollapsed = false }: { railCollapsed?: boolean }) {
  return (
    <form action={logoutAction} className="app-sidebar__logout-form">
      <button
        type="submit"
        className={
          railCollapsed
            ? "app-sidebar__logout app-sidebar__logout--rail-collapsed"
            : "app-sidebar__logout"
        }
        aria-label="Sign out"
      >
        {railCollapsed ? <LogoutGlyph /> : "Sign out"}
      </button>
    </form>
  );
}
