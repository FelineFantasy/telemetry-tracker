import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Keep in sync with `TELEMETRY_SESSION_COOKIE` in `lib/dashboard-project.ts`. */
const SESSION_COOKIE = "telemetry_session";

export function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_TELEMETRY_PUBLIC_DASHBOARD === "true") {
    return NextResponse.next();
  }
  const session = request.cookies.get(SESSION_COOKIE);
  if (session?.value && /^[0-9a-f-]{36}$/i.test(session.value)) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
