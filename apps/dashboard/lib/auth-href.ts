type AuthSearchParams = Pick<URLSearchParams, "get">;

export const DEFAULT_POST_LOGIN_PATH = "/dashboard/overview";

/** Post-login destinations must be in-app paths, not the marketing homepage. */
export function isPostLoginRedirectPath(
  path: string | null | undefined
): path is string {
  return typeof path === "string" && path.startsWith("/") && path !== "/";
}

export function resolvePostLoginPath(next: string | null | undefined): string {
  return isPostLoginRedirectPath(next) ? next : DEFAULT_POST_LOGIN_PATH;
}

/** Preserve invite (and login `next`) when switching between auth pages. */
export function crossAuthHref(
  target: "/login" | "/register",
  searchParams: AuthSearchParams
): string {
  const params = new URLSearchParams();
  const invite = searchParams.get("invite")?.trim();
  if (invite) params.set("invite", invite);
  if (target === "/login") {
    const next = searchParams.get("next");
    if (isPostLoginRedirectPath(next)) params.set("next", next);
  }
  const qs = params.toString();
  return qs ? `${target}?${qs}` : target;
}
