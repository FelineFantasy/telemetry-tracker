import type { ReactNode, SVGProps } from "react";

const monoClass = "app-sidebar__mono-svg";

type IconProps = SVGProps<SVGSVGElement>;

function IconShell({ children, className, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className ? `${monoClass} ${className}` : monoClass}
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Overview — layout grid (user-provided Heroicons-style path) */
export function OverviewNavIcon(props: IconProps) {
  return (
    <IconShell {...props}>
      <path
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z"
      />
    </IconShell>
  );
}

/** Errors — shield with exclamation (user-provided path) */
export function ErrorsNavIcon(props: IconProps) {
  return (
    <IconShell {...props}>
      <path
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z"
      />
    </IconShell>
  );
}

/** Events — calendar (user-provided path) */
export function EventsNavIcon(props: IconProps) {
  return (
    <IconShell {...props}>
      <path
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"
      />
    </IconShell>
  );
}

/** Monitor — user sessions / devices */
export function SessionsNavIcon(props: IconProps) {
  return (
    <IconShell {...props}>
      <path
        d="M2 6a2 2 0 012-2h16a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </IconShell>
  );
}

/** Organization — building */
export function OrgNavIcon(props: IconProps) {
  return (
    <IconShell {...props}>
      <path
        d="M4 20V10l8-6 8 6v10M9 20v-6h6v6"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconShell>
  );
}

/** Team — people */
export function TeamNavIcon(props: IconProps) {
  return (
    <IconShell {...props}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth={1.75} fill="none" />
      <circle cx="15" cy="8" r="3" stroke="currentColor" strokeWidth={1.75} fill="none" />
      <path
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        d="M5 19c.5-3 3.5-4 7-4s6.5 1 7 4"
      />
    </IconShell>
  );
}

/** API key — key shape */
export function ApiKeysNavIcon(props: IconProps) {
  return (
    <IconShell {...props}>
      <path
        d="M15.75 5.25a3 3 0 11-4.243 4.243L7.5 13.5v3h3l4.007-4.007a3 3 0 014.243-4.243z"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 19.5h3M6 18v3"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </IconShell>
  );
}

/** Document with folded corner + lines — documentation (clean geometry at small sizes) */
export function DocsNavIcon(props: IconProps) {
  return (
    <IconShell {...props}>
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </IconShell>
  );
}
