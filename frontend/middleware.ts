import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Mirrors backend/app/core/security.py:_cookie_name() -- "__Host-sid" in
// production, "sid" in dev. This is a presence check only (fast path to
// avoid shipping the whole /app JS bundle to a request with no session at
// all); the backend still validates the session on every API call, and
// ProtectedApp still redirects client-side if the cookie turns out to be
// stale/invalid.
const SESSION_COOKIE_NAMES = ["__Host-sid", "sid"];

export function middleware(request: NextRequest) {
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
  if (!hasSessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
