type AuthSearchParams = Pick<URLSearchParams, "get">;

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
    if (next?.startsWith("/")) params.set("next", next);
  }
  const qs = params.toString();
  return qs ? `${target}?${qs}` : target;
}
