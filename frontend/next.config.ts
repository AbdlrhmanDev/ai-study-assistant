import type { NextConfig } from "next";

// The browser only ever talks to this frontend's own origin at /api/v1/*;
// this server-side rewrite forwards those requests to the real backend.
// That makes the session cookie first-party from the browser's
// perspective, which matters because the frontend and backend are deployed
// as separate services on different subdomains (different sites, per the
// Public Suffix List) -- a cookie scoped to the backend's origin is
// third-party there, and mobile Safari's ITP (and increasingly mobile
// Chrome) blocks or expires third-party cookies, causing an immediate
// logout right after a successful login. Proxying removes the cross-site
// hop entirely instead of trying to work around browser cookie policy.
const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND_INTERNAL_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
