import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Keep in sync with `TELEMETRY_SESSION_COOKIE` in `lib/dashboard-project.ts`. */
const SESSION_COOKIE = "telemetry_session";

function redirectToHomeSignIn(request: NextRequest, next?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("signIn", "1");
  if (next?.startsWith("/")) {
    url.searchParams.set("next", next);
  }
  return NextResponse.redirect(url);
}

function redirectToHomeSignUp(request: NextRequest) {
  const url = request.nextUrl.clone();
  const invite = request.nextUrl.searchParams.get("invite");
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("signUp", "1");
  if (invite) {
    url.searchParams.set("invite", invite);
  }
  return NextResponse.redirect(url);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next") ?? undefined;
    return redirectToHomeSignIn(request, next);
  }

  if (pathname === "/register") {
    return redirectToHomeSignUp(request);
  }

  if (process.env.NEXT_PUBLIC_TELEMETRY_PUBLIC_DASHBOARD === "true") {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE);
  if (session?.value && /^[0-9a-f-]{36}$/i.test(session.value)) {
    return NextResponse.next();
  }

  return redirectToHomeSignIn(
    request,
    request.nextUrl.pathname + request.nextUrl.search,
  );
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/login", "/register"],
};
