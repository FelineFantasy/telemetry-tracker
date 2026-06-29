import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Keep in sync with `TELEMETRY_SESSION_COOKIE` in `lib/dashboard-project.ts`. */
const SESSION_COOKIE = "telemetry_session";

function hasValidSession(request: NextRequest): boolean {
  const session = request.cookies.get(SESSION_COOKIE);
  return Boolean(session?.value && /^[0-9a-f-]{36}$/i.test(session.value));
}

function redirectToLogin(request: NextRequest, next?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (next?.startsWith("/")) {
    url.searchParams.set("next", next);
  }
  return NextResponse.redirect(url);
}

function redirectLegacyAuthQueryParams(request: NextRequest) {
  const signUp = request.nextUrl.searchParams.get("signUp") === "1";
  const signIn = request.nextUrl.searchParams.get("signIn") === "1";
  if (!signUp && !signIn) return null;

  const invite = request.nextUrl.searchParams.get("invite");
  const next = request.nextUrl.searchParams.get("next");
  const url = request.nextUrl.clone();
  url.search = "";

  if (signUp) {
    url.pathname = "/register";
    if (invite) url.searchParams.set("invite", invite);
    return NextResponse.redirect(url);
  }

  url.pathname = "/login";
  if (next?.startsWith("/")) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const legacy = redirectLegacyAuthQueryParams(request);
  if (legacy) return legacy;

  if (pathname === "/login" || pathname === "/register") {
    if (hasValidSession(request)) {
      const invite = request.nextUrl.searchParams.get("invite")?.trim();
      if (pathname === "/register" && invite) {
        return NextResponse.next();
      }
      const url = request.nextUrl.clone();
      if (pathname === "/login") {
        const next = request.nextUrl.searchParams.get("next");
        url.pathname = next?.startsWith("/") ? next : "/dashboard/overview";
      } else {
        url.pathname = "/dashboard/overview";
      }
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (process.env.NEXT_PUBLIC_TELEMETRY_PUBLIC_DASHBOARD === "true") {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  if (hasValidSession(request)) {
    return NextResponse.next();
  }

  return redirectToLogin(
    request,
    request.nextUrl.pathname + request.nextUrl.search,
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
